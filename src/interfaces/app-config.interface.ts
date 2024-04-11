export interface AppConfig {
  readonly corsOrigin: string | string[];
  readonly documentationEnabled: boolean;
  readonly fsDataDirectoryPath: string;

  readonly s3Region: string;
  readonly s3EndpointUrl: string;
  readonly s3AccessKeyId: string;
  readonly s3SecretAccessKey: string;
  readonly s3DataBucketName: string;
  readonly s3DataBucketPath: string;
}
