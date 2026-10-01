// USER-OPERATED only, after approval. Never run through a chat/remote tool.
// Writes secret files outside the repository; never prints their contents.
import {createECDH,randomBytes} from 'node:crypto';
import {mkdtempSync,writeFileSync,chmodSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
if(process.argv[2]!=='--local-user-setup'){
 console.error('Run yourself in your private local terminal: node scripts/prepare-push-secrets.mjs --local-user-setup');process.exit(1);
}
process.umask(0o077);
const directory=mkdtempSync(join(homedir(),'.pth-push-setup-'));chmodSync(directory,0o700);
const curve=createECDH('prime256v1');curve.generateKeys();
const publicKey=curve.getPublicKey(undefined,'uncompressed').toString('base64url');
const scalar=curve.getPrivateKey();
const privateKey=Buffer.concat([Buffer.alloc(32-scalar.length),scalar]).toString('base64url');
const dispatchSecret=randomBytes(32).toString('base64url');
const values={PTH_PUSH_VAPID_PUBLIC_KEY:publicKey,PTH_PUSH_VAPID_PRIVATE_KEY:privateKey,PTH_PUSH_VAPID_SUBJECT:'https://paratuhogar.org',PTH_PUSH_DISPATCH_SECRET:dispatchSecret,PTH_PUSH_ENABLED:'false'};
writeFileSync(join(directory,'edge-secrets.env'),Object.entries(values).map(([key,value])=>`${key}=${value}`).join('\n')+'\n',{mode:0o600,flag:'wx'});
writeFileSync(join(directory,'dispatch-secret.txt'),dispatchSecret,{mode:0o600,flag:'wx'});
console.log(`Prepared private files in: ${directory}`);
console.log('Enter values yourself in Supabase Dashboard Secrets and Vault. Do not upload, commit, paste into chat, or share screenshots. Keep PTH_PUSH_ENABLED=false.');
