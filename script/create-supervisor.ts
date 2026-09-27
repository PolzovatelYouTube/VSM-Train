import "dotenv/config";
import { hashPassword } from "../server/auth";
import { storage } from "../server/storage";

const [name, password] = process.argv.slice(2);
if (!name || !password) {
  console.error('Usage: npm run auth:create-supervisor -- "Имя" "пароль-минимум-8"');
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must contain at least 8 characters.");
  process.exit(1);
}
if (storage.findPlayerByName(name)) {
  console.error("An account with this name already exists. Role changes must be performed by an administrator.");
  process.exit(1);
}

storage.createAccount(name, await hashPassword(password), "supervisor");
console.log(`Supervisor account created: ${name}`);
