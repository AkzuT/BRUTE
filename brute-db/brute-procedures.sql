USE BruteDB;
GO

CREATE PROCEDURE [dbo].[PR_Cleanup_Expired_Pending_Credentials]
AS
BEGIN
	SET NOCOUNT ON;
	BEGIN TRANSACTION;
		BEGIN TRY
			SELECT DISTINCT C.[cred_id], C.[profile_id]
			INTO #DeadCredentials
			FROM [dbo].[Credentials] C
			INNER JOIN [dbo].[Tokens] T ON T.[cred_id] = C.[cred_id]
			WHERE C.[status] = 'PENDING'
				AND T.[token_type] = 'ACTIVATION'
				AND T.[expires_at] <= SYSDATETIME();

			SELECT DISTINCT UP.[profile_id], UP.[phone], UP.[user_id]
			INTO #DeadProfiles
			FROM [dbo].[User_Profiles] UP
			INNER JOIN #DeadCredentials DC ON DC.[profile_id] = UP.[profile_id];

			DELETE T
			FROM [dbo].[Tokens] T
			INNER JOIN #DeadCredentials DC ON T.[cred_id] = DC.[cred_id];

			DELETE C
			FROM [dbo].[Credentials] C
			INNER JOIN #DeadCredentials DC ON C.[cred_id] = DC.[cred_id];

			DELETE UP
			FROM [dbo].[User_Profiles] UP
			INNER JOIN #DeadProfiles DP ON UP.[profile_id] = DP.[profile_id];

			DELETE UPh
			FROM [dbo].[User_Phones] UPh
			INNER JOIN #DeadProfiles DP ON UPh.[phone] = DP.[phone]
			WHERE NOT EXISTS (
				SELECT 1 FROM [dbo].[User_Profiles] UP2
				WHERE UP2.[phone] = UPh.[phone]
			);

			DELETE U
			FROM [dbo].[Users] U
			INNER JOIN #DeadProfiles DP ON U.[user_id] = DP.[user_id]
			WHERE NOT EXISTS (
				SELECT 1 FROM [dbo].[User_Profiles] UP3
				WHERE UP3.[user_id] = U.[user_id]
			);

			COMMIT TRANSACTION;
		END TRY
		BEGIN CATCH
			IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
			THROW;
		END CATCH
END
GO

GRANT EXECUTE ON [dbo].[PR_Cleanup_Expired_Pending_Credentials] TO [BruteDB_Connection];
GO	

/*

DECLARE @jobId BINARY(16)
	EXEC msdb.dbo.sp_add_job
		@job_name = N'BRUTE_Cleanup_Expired_Pending_Credentials',
		@enabled = 1;
		@description = N'Deletes Credentials, Tokens, User_Profiles, User_Phones and Users left behind my registrations that were never activated in time.',
		@job_id = @jobId OUTPUT;
	
	EXEC msdb.dbo.sp_add_jobstep
		@job_id = @jobId,
		@step_name = N'Execute_PR_Cleanip_Expired_Pending_Credentials',
		@subsystem = N'TSQL',
		@command = N'EXEC [dbo].[PR_Cleanup_Expired_Pending_Credentials]',
		@database_name = N'BruteDB',
		@retry_attempts = 2,
		@retry_attempts = 5;

	EXEC msdb.dbo.sp_add_jobschedule
		@job_id = @jobId,
		@name = N'Daily_Schedule',
		@freq_type = 4,
		@freq_interval = 1,
		@freq_subday_type = 8,
		@freq_subday_interval = 24,
		@activate_start_time = 000000;

	EXEC msdb.dbo.sp_add_jobserver
		@job_id = @jobId,
		@server_name = @SERVERNAME;

GO

*/