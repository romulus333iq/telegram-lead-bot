import { Bot, InlineKeyboard, InputFile } from "grammy";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
const LEADS_FILE = join(DATA_DIR, "leads.json");
const CSV_FILE = join(DATA_DIR, "leads.csv");

function loadConfig() {
  const cfgPath = join(__dirname, "config.json");
  let fileCfg = {};
  if (existsSync(cfgPath)) {
    try {
      fileCfg = JSON.parse(readFileSync(cfgPath, "utf8"));
    } catch (err) {
      console.error("Не удалось прочитать config.json:", err.message);
    }
  }
  return {
    token: process.env.BOT_TOKEN || fileCfg.token || "",
    adminId: process.env.ADMIN_CHAT_ID || fileCfg.adminId || "",
  };
}

const config = loadConfig();
if (!config.token) {
  console.error("Нет токена. Укажи BOT_TOKEN в переменных окружения или 'token' в config.json");
  process.exit(1);
}

mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(LEADS_FILE)) writeFileSync(LEADS_FILE, "[]", "utf8");
if (!existsSync(CSV_FILE)) writeFileSync(CSV_FILE, "id,date,name,phone,comment,username\n", "utf8");

function readLeads() {
  try {
    const value = JSON.parse(readFileSync(LEADS_FILE, "utf8"));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveLead(lead) {
  const leads = readLeads();
  leads.push(lead);
  writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), "utf8");
  const esc = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const row = [lead.id, lead.date, lead.name, lead.phone, lead.comment, lead.username].map(esc).join(",");
  appendFileSync(CSV_FILE, row + "\n", "utf8");
}

const bot = new Bot(config.token);
const states = new Map();
const askButton = new InlineKeyboard().text("Оставить заявку", "new_lead");

function isAdmin(id) {
  return Boolean(config.adminId) && String(id) === String(config.adminId);
}

bot.command("start", async (ctx) => {
  await ctx.reply(
    "Здравствуйте! Принимаю заявки круглосуточно.\n\nНажмите кнопку и оставьте контакты — свяжемся в ближайшее время.",
    { reply_markup: askButton }
  );
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    "Команды:\n/start — начать\n/new — новая заявка\n/cancel — отменить\n\nАдмин: /leads, /export, /stats"
  );
});

bot.command("new", async (ctx) => {
  states.set(ctx.from.id, {
    step: "name",
    lead: {
      id: Date.now(),
      date: new Date().toLocaleString("ru-RU"),
      username: ctx.from.username ? "@" + ctx.from.username : "—",
    },
  });
  await ctx.reply("Как вас зовут?");
});

bot.command("cancel", async (ctx) => {
  if (states.delete(ctx.from.id)) {
    await ctx.reply("Отменено.");
  } else {
    await ctx.reply("Нечего отменять.");
  }
});

bot.command("leads", async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply("Только для администратора.");
  const leads = readLeads();
  if (!leads.length) return ctx.reply("Заявок пока нет.");
  const last = leads.slice(-10).reverse();
  const text = last
    .map(
      (l, i) =>
        `${i + 1}. ${l.name} | ${l.phone} | ${l.comment}\n   ${l.username} | ${l.date}`
    )
    .join("\n\n");
  await ctx.reply(`Всего заявок: ${leads.length}\n\nПоследние 10:\n\n${text}`);
});

bot.command("export", async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply("Только для администратора.");
  await ctx.replyWithDocument(new InputFile(CSV_FILE, "leads.csv"));
});

bot.command("stats", async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply("Только для администратора.");
  const leads = readLeads();
  const today = new Date().toLocaleDateString("ru-RU");
  const todayCount = leads.filter((l) => String(l.date).includes(today)).length;
  await ctx.reply(`Всего заявок: ${leads.length}\nСегодня: ${todayCount}`);
});

bot.callbackQuery("new_lead", async (ctx) => {
  await ctx.answerCallbackQuery();
  states.set(ctx.from.id, {
    step: "name",
    lead: {
      id: Date.now(),
      date: new Date().toLocaleString("ru-RU"),
      username: ctx.from.username ? "@" + ctx.from.username : "—",
    },
  });
  await ctx.reply("Как вас зовут?");
});

bot.on("message:text", async (ctx) => {
  const id = ctx.from.id;
  const text = ctx.message.text.trim();
  const state = states.get(id);

  if (!state) {
    await ctx.reply("Нажмите /start, чтобы оставить заявку.");
    return;
  }

  if (text === "/cancel") {
    states.delete(id);
    await ctx.reply("Отменено.");
    return;
  }

  if (state.step === "name") {
    state.lead.name = text;
    state.step = "phone";
    await ctx.reply("Номер телефона или WhatsApp:");
    return;
  }

  if (state.step === "phone") {
    if (text.replace(/\D/g, "").length < 6) {
      await ctx.reply("Похоже, это не номер. Напишите ещё раз:");
      return;
    }
    state.lead.phone = text;
    state.step = "comment";
    await ctx.reply("Что нужно сделать? Напишите пару слов:");
    return;
  }

  if (state.step === "comment") {
    state.lead.comment = text;
    saveLead(state.lead);
    states.delete(id);
    await ctx.reply(`Готово, ${state.lead.name}! Заявка принята.`);

    if (config.adminId) {
      await bot.api.sendMessage(
        config.adminId,
        `Новая заявка:\nИмя: ${state.lead.name}\nТелефон: ${state.lead.phone}\nЗадача: ${state.lead.comment}\nTelegram: ${state.lead.username}\nДата: ${state.lead.date}`
      );
    }
  }
});

bot.catch((err) => {
  console.error("Ошибка бота:", err);
});

const port = Number(process.env.PORT || 3000);
createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("ok");
}).listen(port, "0.0.0.0", () => {
  console.log(`HTTP health-check слушает порт ${port}`);
});

bot.start();
console.log("Бот запущен.");
