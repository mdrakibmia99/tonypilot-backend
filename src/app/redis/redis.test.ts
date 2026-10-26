/* eslint-disable no-console */
import { connectRedis, disconnectRedis, RedisService, pubClient, subClient } from './index';

async function runRedisTests() {
  console.log('--- Starting Redis Verification Tests ---');

  // 1. Connect
  await connectRedis();

  // 2. Test basic Set with TTL and Get
  const testKey = 'test:item:123';
  const testPayload = { id: '123', name: 'tonypilot', roles: ['admin', 'user'], active: true };

  console.log('1. Setting key with 10s TTL...');
  await RedisService.set(testKey, testPayload, 10);

  console.log('2. Getting cached key...');
  const retrieved = await RedisService.get<typeof testPayload>(testKey);
  console.log('Retrieved data:', retrieved);
  if (retrieved?.name !== testPayload.name) {
    throw new Error('Retrieved data mismatch!');
  }
  console.log('✅ Basic Cache Set & Get verified successfully.');

  // 3. Test TTL
  const remainingTTL = await RedisService.ttl(testKey);
  console.log(`Key remaining TTL: ${remainingTTL} seconds`);
  if (remainingTTL <= 0 || remainingTTL > 10) {
    throw new Error(`Unexpected TTL: ${remainingTTL}`);
  }
  console.log('✅ TTL check verified successfully.');

  // 4. Test Cache-Aside getOrSet
  const stampedeKey = 'test:stampede:counter';
  let dbFetchCalls = 0;
  const mockDbQuery = async () => {
    dbFetchCalls++;
    return { count: 42, fetchedAt: new Date().toISOString() };
  };

  console.log('3. Testing getOrSet (cache miss - should call mock DB query)...');
  const result1 = await RedisService.getOrSet(stampedeKey, mockDbQuery, 10);
  console.log('First fetch result:', result1, 'Fetch calls:', dbFetchCalls);

  console.log('4. Testing getOrSet again (cache hit - should NOT call mock DB query)...');
  const result2 = await RedisService.getOrSet(stampedeKey, mockDbQuery, 10);
  console.log('Second fetch result:', result2, 'Fetch calls:', dbFetchCalls);

  if (dbFetchCalls !== 1) {
    throw new Error(`Expected exactly 1 DB call, but got ${dbFetchCalls}`);
  }
  console.log('✅ Cache-Aside (getOrSet) verified with stampede avoidance.');

  // 5. Test Pattern-based invalidation
  console.log('5. Testing pattern invalidation (delByPattern)...');
  await RedisService.set('test:user:1:profile', { name: 'Alice' }, 60);
  await RedisService.set('test:user:1:settings', { theme: 'dark' }, 60);
  await RedisService.set('test:user:2:profile', { name: 'Bob' }, 60);

  const deletedCount = await RedisService.delByPattern('test:user:1:*');
  console.log(`Deleted ${deletedCount} keys matching "test:user:1:*"`);
  if (deletedCount < 2) {
    throw new Error(`Expected at least 2 keys deleted, got ${deletedCount}`);
  }

  const user1Profile = await RedisService.get('test:user:1:profile');
  const user1Settings = await RedisService.get('test:user:1:settings');
  const user2Profile = await RedisService.get('test:user:2:profile');

  if (user1Profile !== null || user1Settings !== null) {
    throw new Error('Keys for user 1 were not deleted!');
  }
  if (user2Profile === null) {
    throw new Error('Key for user 2 was incorrectly deleted!');
  }
  console.log('✅ Pattern-based invalidation verified successfully.');

  // 6. Test Redis Sets for Real-time Socket Presence
  console.log('6. Testing Redis Sets for Socket User Presence...');
  const onlineKey = 'test:online_users';
  await RedisService.sAdd(onlineKey, 'user_001', 'user_002');
  const isUser1Online = await RedisService.sIsMember(onlineKey, 'user_001');
  const isUser3Online = await RedisService.sIsMember(onlineKey, 'user_003');
  const onlineCount = await RedisService.sCard(onlineKey);
  const allOnline = await RedisService.sMembers(onlineKey);

  console.log('Online members:', allOnline, 'Count:', onlineCount);
  if (!isUser1Online || isUser3Online || onlineCount !== 2) {
    throw new Error('Redis Set presence check failed!');
  }

  await RedisService.sRem(onlineKey, 'user_001');
  const isUser1StillOnline = await RedisService.sIsMember(onlineKey, 'user_001');
  if (isUser1StillOnline) {
    throw new Error('user_001 was not removed from presence set!');
  }
  console.log('✅ Redis Set presence operations verified successfully.');

  // 7. Verify Pub and Sub Clients for Socket.io Adapter
  console.log('7. Verifying Dedicated Pub/Sub Clients for Socket.io...');
  const pubPong = await pubClient.ping();
  const subPong = await subClient.ping();
  if (pubPong !== 'PONG' || subPong !== 'PONG') {
    throw new Error('Pub/Sub clients failed PING check!');
  }
  console.log('✅ Dedicated Pub/Sub clients verified successfully (PONG).');

  // Cleanup test keys
  await RedisService.del([testKey, stampedeKey, 'test:user:2:profile', onlineKey]);

  // Disconnect cleanly
  await disconnectRedis();
  console.log('🎉 All Redis tests (Cache, Sets, Pub/Sub) passed with 100% success!');
  process.exit(0);
}

runRedisTests().catch((err) => {
  console.error('❌ Redis test failed:', err);
  process.exit(1);
});
