import { Client, Events, GatewayIntentBits } from 'discord.js';
import { ProfileReader, getStart } from './profile.js';
import { makeCard } from './card.js';

if (!process.env.BOT_TOKEN) { console.error('أضف BOT_TOKEN في متغيرات البيئة.'); process.exit(1); }
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const reader = new ProfileReader(process.env.READER_TOKEN?.trim());
const active = new Set();
const cooldown = new Map();
const errors = {
  NOT_CONFIGURED: 'قراءة تاريخ شارة الحساب غير مفعلة. على صاحب البوت إعداد READER_TOKEN؛ توكن البوت الرسمي وحده لا يوفر هذه التواريخ.',
  AUTH: 'تعذر تسجيل دخول قارئ الملفات الشخصية. يحتاج صاحب البوت مراجعة إعداد القارئ وإعادة التشغيل.',
  FORBIDDEN: 'ديسكورد لم يسمح للقارئ بالوصول إلى ملفك الشخصي. تأكد أن حساب القارئ موجود في السيرفر؛ لن أحسب تاريخًا تخمينيًا.',
  RATE_LIMIT: 'ديسكورد طلب الانتظار قبل قراءة ملفات أخرى. جرّب لاحقًا.',
  BUSY: 'هناك طلبات كثيرة الآن. جرّب بعد قليل.',
  NETWORK: 'تعذر الاتصال بديسكورد خلال الوقت المحدد. جرّب مرة أخرى.',
  MISSING_DATE: 'تاريخ بداية الشارة غير متاح من ملفك الشخصي، لذلك لا أستطيع حساب المدة بدقة.',
  NO_DATE: 'لم يرجع ملفك الشخصي تاريخًا نشطًا لهذه الشارة. قد لا يكون الاشتراك/البوست فعالًا أو قد تكون البيانات غير متاحة.',
  UNAVAILABLE: 'تعذرت قراءة بيانات ملفك الشخصي حاليًا. جرّب لاحقًا.',
};
client.once(Events.ClientReady, bot => {
  console.log(`جاهز: ${bot.user.tag} | -نيترو | -بوست`);
  if (process.env.READER_TOKEN) console.warn('قارئ غير رسمي مفعّل: أتمتة حساب عادي قد تؤدي إلى إغلاق الحساب.');
  else console.warn('READER_TOKEN غير مضبوط؛ لن يمكن قراءة تواريخ شارات الحساب.');
});
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.inGuild()) return;
  if (process.env.GUILD_ID && message.guildId !== process.env.GUILD_ID) return;
  if (process.env.CHANNEL_ID && message.channelId !== process.env.CHANNEL_ID) return;
  const kind = ({ '-نيترو': 'nitro', '-بوست': 'boost' })[message.content.trim()];
  if (!kind) return;
  const id = message.author.id;
  if (active.has(id) || (cooldown.get(id) || 0) > Date.now()) return;
  active.add(id); cooldown.set(id, Date.now() + 3000);
  try {
    await message.channel.sendTyping().catch(() => {});
    const profile = await reader.get(id, message.guildId);
    await message.reply(await makeCard(message.author, kind, getStart(profile, kind)));
  } catch (error) {
    const known = Object.hasOwn(errors, error.code || '');
    console.warn(`[command:${kind}] ${known ? error.code : 'SEND_OR_INTERNAL_ERROR'}`);
    await message.reply({ content: known ? errors[error.code] : 'تعذر إرسال النتيجة. تأكد من صلاحيات إرسال الرسائل والروابط وإرفاق الصور.', allowedMentions: { parse: [], repliedUser: false } }).catch(() => {});
  } finally { active.delete(id); }
});
setInterval(() => { for (const [id, until] of cooldown) if (until < Date.now()) cooldown.delete(id); }, 60000).unref();
client.on(Events.Error, () => console.error('حدث خطأ في اتصال البوت.'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { client.destroy(); process.exit(0); });
client.login(process.env.BOT_TOKEN.trim()).catch(() => { console.error('فشل تشغيل البوت. تحقق من BOT_TOKEN وMessage Content Intent.'); process.exit(1); });
