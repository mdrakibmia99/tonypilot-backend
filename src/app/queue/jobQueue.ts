class JobQueue {

    private queue: (() => Promise<void>)[] = [];

    private processing = false;

    add(job: () => Promise<void>) {

        this.queue.push(job);

        this.process();

    }

    private async process() {

        if (this.processing) return;

        this.processing = true;

        while (this.queue.length) {

            const job = this.queue.shift();

            if (!job) continue;

            try {

                await job();

            } catch (err) {

                console.error(err);

            }

        }

        this.processing = false;

    }

}

export const jobQueue = new JobQueue();