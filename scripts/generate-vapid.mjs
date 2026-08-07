import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("# Add to .env.local / Vercel env (do not commit private key)\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:you@example.com");
console.log("PUSH_CRON_SECRET=change-me-to-a-long-random-string");
console.log("CRON_SECRET=change-me-to-a-long-random-string");
