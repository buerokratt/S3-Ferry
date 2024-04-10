export interface AppConfig {
  readonly corsOrigin: string | string[];
  readonly documentationEnabled: boolean;
  readonly localDirectoryName: string;

  readonly awsProfile: string;
  readonly s3DataBucketName: string;
  readonly s3DataBucketPath: string;
  readonly s3EndpointUrl: string;
}
