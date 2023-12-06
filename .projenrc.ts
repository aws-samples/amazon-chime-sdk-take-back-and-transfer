const { awscdk } = require('projen');
const { JobPermission } = require('projen/lib/github/workflows-model');
const { UpgradeDependenciesSchedule } = require('projen/lib/javascript');

const AUTOMATION_TOKEN = 'PROJEN_GITHUB_TOKEN';
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.97.0',
  defaultReleaseBranch: 'main',
  name: 'amazon-chime-sdk-take-back-and-transfer',
  license: 'MIT-0',
  author: 'Court Schuett',
  copyrightOwner: 'Amazon.com, Inc.',
  authorAddress: 'https://aws.amazon.com',
  jest: false,
  projenrcTs: true,
  appEntrypoint: 'amazon-chime-sdk-take-back-and-transfer.ts',
  depsUpgradeOptions: {
    ignoreProjen: false,
    workflowOptions: {
      labels: ['auto-approve', 'auto-merge'],
      schedule: UpgradeDependenciesSchedule.WEEKLY,
    },
  },
  autoApproveOptions: {
    secret: 'GITHUB_TOKEN',
    allowedUsernames: ['schuettc'],
  },
  deps: [
    'dotenv',
    'cdk-amazon-chime-resources',
    'fs-extra',
    '@types/fs-extra',
    'cdk-nag',
    '@aws-sdk/client-connect',
  ],
  autoApproveUpgrades: true,
  projenUpgradeSecret: 'PROJEN_GITHUB_TOKEN',
});

const common_exclude = [
  '.yalc',
  'cdk.out',
  'cdk.context.json',
  'yarn-error.log',
  'dependabot.yml',
  '.DS_Store',
  '.env',
];

project.addTask('launch', {
  exec: 'yarn && yarn projen && yarn build && yarn cdk bootstrap && yarn cdk deploy --require-approval never --no-rollback',
});

project.gitignore.exclude(...common_exclude);
project.synth();
