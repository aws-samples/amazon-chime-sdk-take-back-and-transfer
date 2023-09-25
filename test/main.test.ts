/* eslint-disable import/no-extraneous-dependencies */
import { App, Aspects } from 'aws-cdk-lib';
import { Annotations, Match, Template } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { nagSuppressions } from './suppressions';
import { AmazonChimeSDKTakBackAndTransfer } from '../src/amazon-chime-sdk-take-back-and-transfer';

const stackProps = {
  logLevel: process.env.LOG_LEVEL || 'INFO',
  connectNumbers: process.env.CONNECT_NUMBERS || '',
  sshPubKey: process.env.SSH_PUB_KEY || ' ',
  allowedDomain: process.env.ALLOWED_DOMAIN || ' ',
};

test('Snapshot', () => {
  const app = new App();
  const stack = new AmazonChimeSDKTakBackAndTransfer(app, 'test', {
    ...stackProps,
  });

  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});

describe('AwsSolutionsChecks', () => {
  const app = new App();
  const stack = new AmazonChimeSDKTakBackAndTransfer(app, 'test', {
    ...stackProps,
  });
  Aspects.of(app).add(new AwsSolutionsChecks());

  NagSuppressions.addStackSuppressions(stack, nagSuppressions);

  test('No unsuppressed Warnings', () => {
    const warnings = Annotations.fromStack(stack).findWarning(
      '*',
      Match.stringLikeRegexp('AwsSolutions-.*'),
    );
    let warningMessages: string[] = [];

    try {
      expect(warnings).toHaveLength(0);
    } catch {
      warnings.forEach((entry: any) => {
        warningMessages.push(entry.entry.data);
      });
      throw new Error(
        'There were warnings found: \n' +
          warningMessages.join('\n ') +
          'See here for Rules: https://github.com/cdklabs/cdk-nag/blob/main/RULES.md',
      );
    }
  });

  test('No unsuppressed Errors', () => {
    const errors = Annotations.fromStack(stack).findError(
      '*',
      Match.stringLikeRegexp('AwsSolutions-.*'),
    );
    let errorMessages: string[] = [];
    try {
      expect(errors).toHaveLength(0);
    } catch {
      errors.forEach((entry: any) => {
        errorMessages.push(entry.entry.data);
      });
      throw new Error(
        'There were errors found: \n' +
          errorMessages.join('\n ') +
          'See here for Rules: https://github.com/cdklabs/cdk-nag/blob/main/RULES.md',
      );
    }
  });
});
