// Send one real test SMS through notification-service, to confirm Twilio
// delivery before relying on the full reminder flow.
//
// Run with (notification-service must already be running — see README):
//   node scripts/test-sms.js +61470375410
// or set TEST_SMS_TO instead of passing an argument.

const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4005';
const to = process.argv[2] || process.env.TEST_SMS_TO;

if (!to) {
  console.error('Usage: node scripts/test-sms.js <+E.164 phone number>');
  console.error('   or: TEST_SMS_TO=+61470375410 node scripts/test-sms.js');
  process.exit(1);
}

console.log(`Sending test SMS to ${to} via ${notificationUrl}...`);

const res = await fetch(`${notificationUrl}/internal/send-sms`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ to, body: 'Bright Smile Dental: this is a test SMS — Twilio is wired up correctly.' }),
});
const data = await res.json().catch(() => ({}));

if (res.ok && data.ok) {
  console.log(`Sent. Twilio message SID: ${data.detail}`);
} else {
  console.error(`Failed (HTTP ${res.status}): ${data.detail || data.error || 'unknown error'}`);
  process.exit(1);
}
