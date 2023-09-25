export const nagSuppressions = [
  {
    id: 'AwsSolutions-CFR1',
    reason: 'Demo does not need GEO restrictions',
  },
  {
    id: 'AwsSolutions-CFR2',
    reason: 'Demo does not need WAF',
  },
  {
    id: 'AwsSolutions-COG2',
    reason: 'Demo cannot use MFA on Cognito',
  },
  {
    id: 'AwsSolutions-DDB3',
    reason: 'Demo does not need continuous backups of DynamoDB.',
  },
  {
    id: 'AwsSolutions-VPC7',
    reason: 'Demo does not need VPC flow logs.',
  },
  {
    id: 'AwsSolutions-EC23',
    reason: 'False positive.',
  },
  {
    id: 'AwsSolutions-ELB2',
    reason: 'Demo does not require ELB Access logs',
  },
  {
    id: 'AwsSolutions-CFR3',
    reason: 'Demo does not require CloudFront Access logs',
  },
  {
    id: 'AwsSolutions-CFR4',
    reason: 'False positive.',
  },
  {
    id: 'AwsSolutions-CFR5',
    reason: 'Origin uses HTTP',
  },
  {
    id: 'AwsSolutions-IAM4',
    reason: 'AWS Managed Policies are used',
  },
  {
    id: 'AwsSolutions-IAM5',
    reason: 'Numerous false positives.  AWS Managed Policies are used.',
  },
  {
    id: 'AwsSolutions-S1',
    reason: 'Demo does not need S3 bucket logs',
  },
  {
    id: 'AwsSolutions-EC28',
    reason: 'Demo does not require detailed monitoring',
  },
  {
    id: 'AwsSolutions-EC29',
    reason: 'Demo does not require termination protection',
  },
  {
    id: 'AwsSolutions-L1',
    reason: 'False positive.  All Lambdas are on the latest runtime',
  },
];
