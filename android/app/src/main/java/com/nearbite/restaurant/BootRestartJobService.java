package com.nearbite.restaurant;

import android.app.job.JobParameters;
import android.app.job.JobService;
import android.util.Log;

public class BootRestartJobService extends JobService {

    private static final String TAG = "YumDudeBootJob";

    @Override
    public boolean onStartJob(JobParameters params) {
        int jobId = params != null ? params.getJobId() : -1;
        Log.i(TAG, "Polling restart job started id=" + jobId);

        if (jobId == BootReceiver.WATCHDOG_JOB_ID && OrderPollingService.isRunning()) {
            Log.d(TAG, "Watchdog checked: polling service is already running");
            jobFinished(params, false);
            return false;
        }

        BootReceiver.restartPollingService(this, "job_scheduler_" + jobId);
        jobFinished(params, false);
        return false;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        Log.w(TAG, "Boot restart job stopped before completion; retrying");
        return true;
    }
}
