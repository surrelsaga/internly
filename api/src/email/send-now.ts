import { dataSource } from '../data-source.js';
import { EmailService, WeeklyEmail } from './email.js';

// npm --prefix api run email:send-now
await dataSource.initialize();
await new WeeklyEmail(dataSource, new EmailService()).sendNow();
await dataSource.destroy();
console.log('sent');
