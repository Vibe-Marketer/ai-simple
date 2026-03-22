import dns from 'dns';
import net from 'net';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const disposableDomains = require('disposable-email-domains');
const disposableSet = new Set(disposableDomains);

const MX_PROVIDER_MAP = [
  { pattern: /google|gmail|googlemail/i, provider: 'google' },
  { pattern: /outlook|microsoft|hotmail|office365/i, provider: 'microsoft' },
  { pattern: /proton/i, provider: 'protonmail' },
  { pattern: /zoho/i, provider: 'zoho' },
  { pattern: /yahoodns|yahoo/i, provider: 'yahoo' },
  { pattern: /icloud|apple/i, provider: 'apple' },
  { pattern: /mimecast/i, provider: 'mimecast' },
  { pattern: /barracuda/i, provider: 'barracuda' },
  { pattern: /pphosted|proofpoint/i, provider: 'proofpoint' },
];

function identifyMxProvider(mxRecords) {
  if (!mxRecords || mxRecords.length === 0) return null;
  const primary = mxRecords.sort((a, b) => a.priority - b.priority)[0].exchange;
  for (const { pattern, provider } of MX_PROVIDER_MAP) {
    if (pattern.test(primary)) return provider;
  }
  return 'custom';
}

async function resolveMx(domain) {
  return new Promise((resolve) => {
    dns.resolveMx(domain, (err, addresses) => {
      if (err) return resolve(null);
      resolve(addresses);
    });
  });
}

function smtpVerify(mxHost, email, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let step = 'connect';
    let buffer = '';
    let resolved = false;

    const done = (result) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve(result);
    };

    const timer = setTimeout(() => done(null), timeoutMs);

    socket.connect(25, mxHost, () => {
      step = 'greeting';
    });

    socket.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\r\n');
      const lastComplete = lines[lines.length - 2] || '';

      if (step === 'greeting' && /^220/.test(lastComplete)) {
        step = 'ehlo';
        buffer = '';
        socket.write('EHLO verify.aisimple.co\r\n');
      } else if (step === 'ehlo' && /^250/.test(lastComplete)) {
        step = 'mailfrom';
        buffer = '';
        socket.write('MAIL FROM:<verify@aisimple.co>\r\n');
      } else if (step === 'mailfrom' && /^250/.test(lastComplete)) {
        step = 'rcptto';
        buffer = '';
        socket.write(`RCPT TO:<${email}>\r\n`);
      } else if (step === 'rcptto') {
        if (/^250|^251/.test(lastComplete)) {
          done({ accepted: true, code: parseInt(lastComplete) });
        } else if (/^5\d\d/.test(lastComplete)) {
          done({ accepted: false, code: parseInt(lastComplete) });
        }
      }
    });

    socket.on('error', () => done(null));
    socket.on('timeout', () => done(null));
    socket.setTimeout(timeoutMs);
  });
}

function smtpCatchAll(mxHost, domain, timeoutMs = 5000) {
  const fakeEmail = `xyzcheck${Date.now()}@${domain}`;
  return smtpVerify(mxHost, fakeEmail, timeoutMs);
}

export async function verifyEmail(email) {
  const result = {
    valid: null,
    mx_provider: null,
    is_disposable: false,
    is_catchall: null,
    smtp_verified: null,
  };

  if (!email || !email.includes('@')) {
    result.valid = false;
    return result;
  }

  const domain = email.split('@')[1].toLowerCase();

  // Disposable check (instant, no network)
  result.is_disposable = disposableSet.has(domain);

  // MX lookup
  const mxRecords = await resolveMx(domain);
  if (!mxRecords || mxRecords.length === 0) {
    result.valid = false;
    return result;
  }

  result.valid = true;
  result.mx_provider = identifyMxProvider(mxRecords);

  // SMTP verification (best effort — many servers block this)
  const primaryMx = mxRecords.sort((a, b) => a.priority - b.priority)[0].exchange;
  try {
    const smtpResult = await smtpVerify(primaryMx, email);
    if (smtpResult) {
      result.smtp_verified = smtpResult.accepted;

      // Catch-all detection only if SMTP check succeeded
      if (smtpResult.accepted) {
        const catchAllResult = await smtpCatchAll(primaryMx, domain);
        result.is_catchall = catchAllResult?.accepted === true;
      }
    }
  } catch {
    // SMTP check failed — leave as null (unknown)
  }

  return result;
}
