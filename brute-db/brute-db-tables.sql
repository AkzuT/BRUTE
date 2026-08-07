CREATE DATABASE [BruteDB]
GO

USE [BruteDB]
GO

CREATE TABLE [dbo].[Users](
	[user_id] CHAR(9) NOT NULL,
	[created_at] DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

	CONSTRAINT PK_Users PRIMARY KEY CLUSTERED ([user_id]),

	CONSTRAINT CHK_UserId CHECK (LEN([user_id]) = 9 AND [user_id] NOT LIKE '%[^0-9]%'),
)
GO

CREATE TABLE [dbo].[User_Phones](
	[phone] CHAR(8) NOT NULL,
	[user_id] CHAR(9) NOT NULL,

	CONSTRAINT PK_UserPhones PRIMARY KEY CLUSTERED ([phone]),

	CONSTRAINT CHK_UserPhones_Phone CHECK (LEN([phone]) = 8 AND [phone] NOT LIKE '%[^0-9]%'),
	
	CONSTRAINT FK_UserPhones_Users FOREIGN KEY ([user_id]) REFERENCES [dbo].[Users]([user_id]),

	CONSTRAINT UQ_UserPhones_Phone_UserId UNIQUE ([phone], [user_id]),
)
GO

CREATE TABLE [dbo].[User_Profiles](
	[profile_id] INT IDENTITY(1, 1) NOT NULL,
	[user_id] CHAR(9) NOT NULL,
	[profile_type] VARCHAR(12) NOT NULL,
	[name] NVARCHAR(50) NOT NULL,
	[first_last_name] NVARCHAR(50) NOT NULL,
	[second_last_name] NVARCHAR(50) NOT NULL,
	[profile_picture] NVARCHAR(255) NOT NULL,
	[email] NVARCHAR(255) NOT NULL,
	[phone] CHAR(8) NOT NULL,

	CONSTRAINT PK_UserProfiles PRIMARY KEY CLUSTERED ([profile_id]),

	CONSTRAINT FK_UserProfiles_Users FOREIGN KEY ([user_id]) REFERENCES [dbo].[Users]([user_id]),

	CONSTRAINT CHK_UserProfiles_ProfileType CHECK ([profile_type] IN('UNPRIVILEGED', 'PRIVILEGED')),

	CONSTRAINT UQ_UserProfiles_ProfileType UNIQUE ([user_id], [profile_type]),

	CONSTRAINT CHK_UserProfiles_Email CHECK (([email]) LIKE '%_@_%._%' AND [email] NOT LIKE '% %'),

	CONSTRAINT FK_UserProfiles_UserPhones FOREIGN KEY ([phone], [user_id]) REFERENCES [dbo].[User_Phones]([phone], [user_id]),
)
GO

CREATE TABLE [dbo].[Credentials](
	[cred_id] INT IDENTITY(1, 1) NOT NULL,
	[profile_id] INT NOT NULL,
	[identifier] NVARCHAR(255) NOT NULL,
	[password_hash] VARCHAR(255) NULL,

	[mfa_enrolled] BIT NOT NULL DEFAULT 0,
	[encrypted_mfa_secret] VARBINARY(512) NULL,
	[mfa_secret_issued_at] DATETIME2 NULL,

	[failed_attempts] INT NOT NULL DEFAULT 0,
	[locked_until] DATETIME2 NULL,

	[status] VARCHAR(12) NOT NULL DEFAULT 'PENDING',

	CONSTRAINT PK_Credentials PRIMARY KEY CLUSTERED ([cred_id]),

	CONSTRAINT FK_Credentials_UserProfiles FOREIGN KEY ([profile_id]) REFERENCES [dbo].[User_Profiles]([profile_id]),

	CONSTRAINT UQ_Credentials_ProfileId_Identifier UNIQUE ([profile_id], [identifier]),

	CONSTRAINT CHK_Credentials_FailedAttempts CHECK ([status] >= 0),

	CONSTRAINT CHK_Status CHECK ([status] IN('PENDING', 'ACTIVATED', 'LOCKED', 'BLOCKED', 'COMPROMISED', 'REACTIVATING', 'DISABLED')),

	CONSTRAINT CHK_Credentials_ActivatedRequiresMFA CHECK ([status] <> 'ACTIVATED' OR [mfa_enrolled] = 1)
)
GO

CREATE UNIQUE INDEX UQ_Credentials_Identifier_Active
	ON [dbo].[Credentials]([identifier])
	WHERE [status] != 'PENDING'
GO

CREATE TABLE [dbo].[Tokens](
	[token_id] INT IDENTITY(1, 1) NOT NULL,
	[cred_id] INT NOT NULL,
	[token_type] VARCHAR(15) NOT NULL,
	[token_hash] VARCHAR(255) NOT NULL,
	[created_at] DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
	[expires_at] DATETIME2 NOT NULL,
	[revoked] BIT NOT NULL DEFAULT 0,
	[user_agent] NVARCHAR(255) NOT NULL,

	CONSTRAINT PK_Tokens PRIMARY KEY CLUSTERED ([token_id]),

	CONSTRAINT FK_Tokens_Credentials FOREIGN KEY ([cred_id]) REFERENCES [dbo].[Credentials]([cred_id]),

	CONSTRAINT CHK_Tokens_TokenType CHECK (token_type IN(
			'ACTIVATION',
			'REFRESH',
			'SESSION',
			'PASSWORD_RESET',
			'PASSWORD_CHANGE',
			'EMAIL_CHANGE',
			'PHONE_CHANGE',
			'FRAUD_FLAG',
			'MFA_RESET',
			'REACTIVATION'
		)),

	CONSTRAINT UQ_Tokens_TokenHash UNIQUE ([token_hash])
)
GO

CREATE INDEX IX_Tokens_CredId_TokenType
	ON [dbo].[Tokens]([cred_id], [token_type])
GO