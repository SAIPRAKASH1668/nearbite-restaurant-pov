package com.nearbite.restaurant;

import android.app.job.JobParameters;
import android.app.job.JobService;
import android.util.Log;

public class BootRestartJobService extends JobService {

    private static final String TAG = "YumDudeBootJob";

    @Override
    public boolean onStartJob(JobParameters params) {
        Log.i(TAG, "Boot restart job started");
        BootReceiver.scheduleWatchdogJob(this, "job_scheduler");
        BootReceiver.restartPollingService(this, "job_scheduler");
        jobFinished(params, false);
        return false;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        Log.w(TAG, "Boot restart job stopped before completion; retrying");
        return true;
    }
}
