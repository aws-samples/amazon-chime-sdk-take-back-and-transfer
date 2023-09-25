import { AmazonChimeSDKTakeBackAndTransferProps } from './amazon-chime-sdk-take-back-and-transfer';
const phonePattern = /^\+1\d{10}(,\+1\d{10})*$/;
const sshKeyPattern =
  /^(ssh-dss AAAAB3NzaC1kc3|ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNT|sk-ecdsa-sha2-nistp256@openssh.com AAAAInNrLWVjZHNhLXNoYTItbmlzdHAyNTZAb3BlbnNzaC5jb2|ssh-ed25519 AAAAC3NzaC1lZDI1NTE5|sk-ssh-ed25519@openssh.com AAAAGnNrLXNzaC1lZDI1NTE5QG9wZW5zc2guY29t|ssh-rsa AAAAB3NzaC1yc2)[0-9A-Za-z+/]+[=]{0,3}(\s.*)?$/;

const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function EnvValidator(props: AmazonChimeSDKTakeBackAndTransferProps) {
  if (props.logLevel) {
    if (
      props.logLevel.toLowerCase() !== 'error' &&
      props.logLevel.toLowerCase() !== 'warn' &&
      props.logLevel.toLowerCase() !== 'debug' &&
      props.logLevel.toLowerCase() !== 'info'
    ) {
      throw new Error('LOG_LEVEL must be ERROR, WARN, DEBUG, or INFO');
    }
  }

  if (props.connectNumbers.length === 0) {
    throw new Error('CONNECT_PHONE_NUMBERS is required');
  }

  if (phonePattern.test(props.connectNumbers) === false) {
    throw new Error(
      'CONNECT_PHONE_NUMBERS must be a comma-separated list of E.164 US phone numbers (+1XXXYYYZZZZ,+1XXXYYYZZZZ)',
    );
  }

  if (
    props.sshPubKey &&
    props.sshPubKey.length > 1 &&
    !sshKeyPattern.test(props.sshPubKey)
  ) {
    throw new Error('Invalid SSH Public Key format');
  }

  if (
    props.allowedDomain &&
    props.allowedDomain.length > 0 &&
    domainPattern.test(props.allowedDomain)
  ) {
    throw new Error('Invalid Allowed Domain format');
  }

  return true;
}
