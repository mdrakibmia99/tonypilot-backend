import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { adminService } from './admin.service';
import { IJwtPayload } from '../auth/auth.interface';

const getTelemetryOverview = catchAsync(async (_req: Request, res: Response) => {
  const result = await adminService.getTelemetryOverview();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Telemetry overview retrieved successfully',
    data: result,
  });
});

const getActiveLiveStreamsControlRoom = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user.userId;
  const result = await adminService.getActiveLiveStreamsControlRoom(adminId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Active streams retrieved for control room',
    data: result,
  });
});

const forceTerminateStream = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user.userId;
  const adminRole = req.user.role;
  const streamId = req.params.id as string;
  const result = await adminService.forceTerminateStream(
    adminId,
    adminRole,
    streamId,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Stream successfully terminated by admin moderation',
    data: result,
  });
});

const muteHost = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user.userId;
  const adminRole = req.user.role;
  const streamId = req.params.id as string;
  const result = await adminService.muteHost(
    adminId,
    adminRole,
    streamId,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Host microphone mute command dispatched',
    data: result,
  });
});

const takeUserModerationAction = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user.userId;
  const adminRole = req.user.role;
  const targetUserId = req.params.id as string;
  const result = await adminService.takeUserModerationAction(
    adminId,
    adminRole,
    targetUserId,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Moderation action executed successfully',
    data: result,
  });
});

const reviewStoryClaim = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user.userId;
  const adminRole = req.user.role;
  const claimId = req.params.id as string;
  const result = await adminService.reviewStoryClaim(
    adminId,
    adminRole,
    claimId,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Story claim review action recorded',
    data: result,
  });
});

const getAdminAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const result = await adminService.getAdminAuditLogs(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Audit logs retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getRevenueAnalytics = catchAsync(async (req: Request, res: Response) => {
  const result = await adminService.getRevenueAnalytics(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Revenue analytics retrieved successfully',
    data: result,
  });
});

const blockedUser = catchAsync(async (req: Request, res: Response) => {
  const result = await adminService.blockedUser(
    req.user as IJwtPayload,
    req.params.id as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User blocked status updated',
    data: result,
  });
});

const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const result = await adminService.deleteUser(
    req.user as IJwtPayload,
    req.params.id as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User deleted successfully',
    data: result,
  });
});

const getSupervisedUsers = catchAsync(async (req: Request, res: Response) => {
  const result = await adminService.getSupervisedUsers(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Supervised members retrieved successfully',
    data: result,
  });
});

const getUserInspectionDetails = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await adminService.getUserInspectionDetails(id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User inspection details retrieved successfully',
    data: result,
  });
});

export const adminController = {
  getTelemetryOverview,
  getActiveLiveStreamsControlRoom,
  forceTerminateStream,
  muteHost,
  takeUserModerationAction,
  reviewStoryClaim,
  getAdminAuditLogs,
  getRevenueAnalytics,
  getSupervisedUsers,
  getUserInspectionDetails,
  blockedUser,
  deleteUser,
};
