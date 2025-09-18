require('dotenv').config();
// eslint-disable-next-line no-undef
const express = require('express');
const app = express();
// eslint-disable-next-line no-undef
const axios = require('axios');

app.use(express.json());

// const port = process.env.PORT || 3000;

// eslint-disable-next-line no-undef
const TelegramApi = require('node-telegram-bot-api');
// eslint-disable-next-line no-undef
const admin = require('firebase-admin');
// eslint-disable-next-line no-undef
require('firebase/database');
// eslint-disable-next-line no-undef
const serviceAccount = require('../secrets/serviceAccountKey.json');
// eslint-disable-next-line no-undef
const token = process.env.token;
const bot = new TelegramApi(token, {polling: true});

// Your web app's Firebase configuration
const firebaseConfig = {
  credential: admin.credential.cert(serviceAccount),
};

// Initialize Firebase
admin.initializeApp(firebaseConfig);

// Получаем доступ к Realtime Database
const database = admin.database();

// eslint-disable-next-line no-undef
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID; // ID группы для отправки сообщений администраторам
// eslint-disable-next-line no-undef
const DEPOSIT_GROUP_ID = process.env.DEPOSIT_GROUP_ID;
// eslint-disable-next-line no-undef
const ORDERS_GROUP_ID = process.env.ORDERS_GROUP_ID;
// eslint-disable-next-line no-undef
const CRYPTOBOT_ID = process.env.CRYPTOBOT_ID;

let admins = {};
database.ref('admins').once('value').then((snapshot) => {
  admins = snapshot.val() || {};
  // Если список администраторов пуст, добавляем первого админа
  if (!Object.keys(admins).length) {
    admins[ADMIN_CHAT_ID.toString()] = true;
    database.ref('admins').set(admins);
  }
});

function isAdmin(chatId) {
  const id = chatId.toString();
  if (admins[id] === true) {
    return true;
  }
  return false;
}

function sendDepositRequest(message, inlineKeyboard = null) {
  sendToGroup(DEPOSIT_GROUP_ID, message, inlineKeyboard);
}

function sendOrderRequest(message, inlineKeyboard = null) {
  sendToGroup(ORDERS_GROUP_ID, message, inlineKeyboard);
}

function sendToGroup(groupId, message, inlineKeyboard = null) {
  const options = inlineKeyboard ? { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } } : { parse_mode: 'HTML',};
  bot.sendMessage(groupId, message, options);
}

function sendMessageToAllAdmins(message, inlineKeyboard = null) {
  Object.keys(admins).forEach(adminId => {
    const options = {};

    if (inlineKeyboard) {
      options.reply_markup = {
        inline_keyboard: inlineKeyboard
      };
    }

    bot.sendMessage(adminId, message, options)
  });
}

let paymentDetails;

database.ref('paymentDetails').once('value').then((snapshot) => {
  paymentDetails = snapshot.val() || {
    card: `ТИНЬКОФФ

Карта: 2200701726843458

СБЕРБАНК

Карта: 2202206953213159`,
    CryptoBot: 'http://t.me/send?start=IVGW3jJOOu59'
  };
});

// Загрузка товаров
let products = [];
let productsId = [];
const idCom = 1.025

database.ref('products').once('value').then((snapshot) => {
  products = snapshot.val() || [  { label: '60', price: 0.86 },
    { label: '325', price: 4.30 },
    { label: '660', price: 8.45 },
    { label: '1800', price: 21.50 },
    { label: '3850', price: 42.00 },
    { label: '8100', price: 81.50 },
  ];
  productsId = products.map(product => {
    const increasedPrice = product.price * idCom; // Увеличиваем на 4.5%
    const roundedPrice = Math.round(increasedPrice * 100) / 100; // Округляем до сотых
    
    return {
      label: product.label,
      price: roundedPrice
    };
  });
});

// Загрузка балансов пользователей
let userBalances = {};

database.ref('userBalances').once('value').then((snapshot) => {
  userBalances = snapshot.val() || {};
});

const userCarts = {};

async function getCbrUsdRate() {
  try {
    const response = await axios.get('https://www.cbr-xml-daily.ru/daily_json.js');
    const usdRate = response.data.Valute.USD.Value;
    const updateTime = new Date(response.data.Date).toLocaleString('ru-RU');
    return { usdRate, updateTime };
  } catch (error) {
    console.error('Ошибка при получении курса:', error);
    return null;
  }
}

const rubToUsd = (amount, usdRate) => {
  return (Math.round((amount / usdRate) * 100) / 100)
}

const safeRound = (num) => {
  const stringNum = num.toFixed(10);
  const match = stringNum.match(/\.(\d{2})(9{4,})/);
  return match ? Number(stringNum.slice(0, match.index + 3)) : num;
};

// Функция обновления сообщения с корзиной

const generateShopKeyboard = async (cart, type) => {
  const prods = type === 'id' ? productsId : products;
  
  // Создаем хеш-таблицу для быстрого подсчета количества в корзине
  let counts = {};
  if (cart) {
    counts = cart.items.reduce((acc, item) => {
      acc[item.label] = (acc[item.label] || 0) + 1;
      return acc;
    }, {});
  }

  // Если тип - codes, получаем количество доступных кодов для каждого товара
  let availableCodes = {};
  if (type === 'codes') {
    try {
      const codesSnapshot = await database.ref('codes').once('value');
      const codesData = codesSnapshot.val() || {};
      
      // Перебираем все товары (60, 325, 660 и т.д.)
      Object.entries(codesData).forEach(([productLabel, productCodes]) => {
        // Перебираем все коды для данного товара
        Object.values(productCodes).forEach(codeObj => {
          if (codeObj.used === false && codeObj.code) {
            // Используем productLabel (60, 325 и т.д.) как ключ
            availableCodes[productLabel] = (availableCodes[productLabel] || 0) + 1;
          }
        });
      });
    } catch (error) {
      console.error('Error counting codes:', error);
    }
  }

  // Генерируем кнопки с актуальным количеством
  const buttons = prods.map(p => {
    const inCart = counts ? counts[p.label] || 0 : 0;
    
    let buttonText;
    if (type === 'codes') {
      const available = availableCodes[p.label] || 0;
      buttonText = `${p.label} UC - ${p.price}$ (${inCart}/${available})`;
    } else {
      buttonText = `${p.label} UC - ${p.price}$ (×${inCart})`;
    }

    return {
      text: buttonText,
      callback_data: `add-to-cart_${p.label}_${p.price}_${type}`
    };
  });

  const rows = [];
  while (buttons.length > 0) {
    rows.push(buttons.splice(0, 2));
  }

  if (type === 'codes') {
    rows.push([{ text: '🛒 Купить кодами', callback_data: 'cart_buy-codes'}])
  } else if (type === 'id') {
    rows.push([{ text: '🛒 Купить по ID', callback_data: 'cart_buy-with-id' }])
  }

  // Добавляем управляющие кнопки
  rows.push(
    [
      { text: '🗑 Очистить корзину', callback_data: `cart_clear_${type}` }
    ],
    [
      { text: '🔙 В главное меню', callback_data: 'return' }
    ]
  );

  return rows;
}

async function updateCartMessage(chatId, messageId, type) {
  const cart = userCarts[chatId] || { items: [], total: 0 };
  const caption = generateCartText(cart);
  const keyboard = { inline_keyboard: await generateShopKeyboard(cart, type) };

  try {
    if (messageId) {
      // Пытаемся отредактировать существующее сообщение
      await bot.editMessageCaption(caption, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
      return messageId; // Возвращаем тот же messageId
    }
  } catch (editError) {
    // Если сообщение не найдено, отправляем новое
    if (editError.response?.description.includes('message to edit not found')) {
      return await sendNewCartMessage(chatId, caption, keyboard);
    }
  }

  // Если messageId нет или редактирование не удалось
  return await sendNewCartMessage(chatId, caption, keyboard);
}

async function sendNewCartMessage(chatId, caption, keyboard) {
  try {
    // Пытаемся отправить с фото
    const sentMessage = await bot.sendPhoto(chatId, IMAGES.pack, {
      caption: caption,
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
    
    return sentMessage.message_id;

  } catch (photoError) {
    console.error('Ошибка отправки фото:', photoError.message);
    
    // Фолбэк на текстовое сообщение
    const sentMessage = await bot.sendMessage(chatId, caption, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
    
    return sentMessage.message_id;
  }
}

// Генерация текста корзины
function generateCartText(cart) {
  if (!cart) {
    return `<b>➤ Выберите UC для покупки (можно несколько) 
🛒 Ваша корзина пуста</b>\n`;
  }

  const itemsCount = cart.items.reduce((acc, item) => {
    acc[item.label] = (acc[item.label] || 0) + 1;
    return acc;
  }, {});
  
  const itemsText = Object.entries(itemsCount)
    .map(([label, count]) => `<b>➥ ${label} UC × ${count} = ${Math.round(count * products.find(p => p.label === label).price * 100) / 100 }$</b>`)
    .join('\n');
  
  return `<b>➤ Выберите UC для покупки (можно несколько)
🛒 Ваша корзина:\n\n${itemsText}\n\n✦ Итого: <u>${cart.total}$</u></b>`;
}

// Обработка покупки
async function purchaseWithId(chatId, messageId) {
  const cart = userCarts[chatId];
  
  if (!cart || cart.items.length === 0) {
    // await bot.answerCallbackQuery(query.id, { text: '❌ Корзина пуста!' });
    return;
  }
  
  if (userBalances[chatId] < cart.total) {
    // await bot.answerCallbackQuery(query.id, { text: '❌ Недостаточно средств!' });
    await bot.sendMessage(chatId, '❌ Недостаточно средств! Пополните свой баланс.', {
      reply_markup: {
        inline_keyboard: [[{text: '💳Пополнить баланс', callback_data: 'deposit'}],]
      }
    })
    return;
  }

  awaitingPubgId[chatId] = cart;

  bot.editMessageCaption('✦ Отправьте игровой ID для зачисления товара! ', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: {
      inline_keyboard: [
        [{text: '🔙 В меню', callback_data: 'return'}]
      ]
    }
  })
}

// Модифицировать функцию покупки кодами
const purchaseCodes = async (chatId, messageId, firstName, lastName) => {
  const cart = userCarts[chatId];
  if (!cart || cart.items.length === 0) {
    await bot.sendMessage(chatId, '❌ Корзина пуста!');
    return;
  }

  // Проверка баланса
  if (userBalances[chatId] < cart.total) {
    await bot.sendMessage(chatId, '❌ Недостаточно средств! Пополните баланс.', {
      reply_markup: {
        inline_keyboard: [[{text: '💳Пополнить баланс', callback_data: 'deposit'}]]
      }
    });
    return;
  }

  // Проверка наличия кодов
  const requiredCodes = cart.items.reduce((acc, item) => {
    acc[item.label] = (acc[item.label] || 0) + 1;
    return acc;
  }, {});

  const codeCheckPromises = Object.keys(requiredCodes).map(async (label) => {
    const snapshot = await database.ref(`codes/${label}`)
      .orderByChild('used')
      .equalTo(false)
      .once('value');
    return snapshot.numChildren() >= requiredCodes[label];
  });

  const results = await Promise.all(codeCheckPromises);
  if (results.some(available => !available)) {
    await bot.sendMessage(chatId, '❌ Недостаточно кодов для выполнения заказа');
    return;
  }

  // Резервирование кодов
  const codesToSend = {};
  for (const label of Object.keys(requiredCodes)) {
    const snapshot = await database.ref(`codes/${label}`)
      .orderByChild('used')
      .equalTo(false)
      .limitToFirst(requiredCodes[label])
      .once('value');

    const codes = snapshot.val();
    codesToSend[label] = Object.keys(codes).map(key => codes[key].code);

    // Пометить коды как использованные
    const updates = {};
    Object.keys(codes).forEach(key => {
      updates[`codes/${label}/${key}/used`] = true;
    });
    await database.ref().update(updates);
  }

  // Списание средств
  userBalances[chatId] -= cart.total;
  await database.ref(`userBalances/${chatId}`).set(userBalances[chatId]);

  // Сохранение заказа
  const orderNumber = Date.now().toString(36).toUpperCase() + chatId.toString().slice(-4);
  const orderData = {
    orderId: orderNumber,
    userId: chatId,
    type: 'codes',
    codes: codesToSend,
    items: cart.items,
    total: cart.total,
    status: 'confirmed',
    timestamp: Date.now(),
    userInfo: {
      username: `${firstName} ${lastName}`,
      balanceBefore: userBalances[chatId] + cart.total,
      balanceAfter: userBalances[chatId]
    }
  };

  try {
    await ordersRef.child(chatId).child(orderNumber).set(orderData);
  } catch (error) {
    console.error('Ошибка сохранения заказа:', error);
    await bot.sendMessage(chatId, '❌ Ошибка оформления заказа, попробуйте позже');
    return;
  }

  let codesMessage = '';
  for (const [label, codes] of Object.entries(codesToSend)) {
    const formattedCodes = codes.map(code => `<code>${code}</code>`).join('\n');
    codesMessage += `➥ ${label} UC:\n${formattedCodes}\n\n`;
  }

  // Отправка кодов пользователю
  let message = '✅ Ваши коды:\n\n' + codesMessage;

  // Очистка корзины
  delete userCarts[chatId];
  
  await bot.sendMessage(chatId, message, {
    parse_mode: 'HTML'
  });
  sendMainMessage(chatId, firstName, lastName);
  await bot.deleteMessage(chatId, messageId);

  // Уведомление админам

  sendOrderRequest(`✅ Новый заказ кодами #${orderNumber}\n` +
    `Пользователь: ${firstName} ${lastName} (ID: ${chatId})\n` +
    `Коды:\n\n` + codesMessage + 
    `Сумма: ${cart.total}$`);
};

const ordersRef = database.ref('orders');

let awaitingCodesForProduct = {};
const productCodesRef = database.ref('codes');

// Для ожидания суммы пополнения и отправки чека
let awaitingDeposit = {};  // Ожидание суммы для пополнения
let awaitingReceipt = {};  // Ожидание чека
let awaitingPubgId = {};   // Ожидание ввода PUBG ID от пользователя
let pendingChecks = {};    // Храним информацию о пользователях, чьи чеки ожидают подтверждения
let customersOrders = {};
let awaitingToChangeProduct = {};
let awaitingNewProductLabel = {};
let awaitingNewProductPrice = {};
let awaitingToChangeCredentials = {};
let awaitingUserToChangeBalance = {};
let awaitingToChangeBalance = {};
let awaitingToCreateMailing = {};
let awaitingToAddAdmin = {};
let awaitingToRemoveAdmin = {};
let cryptobotDeposits = {};

database.ref('pendingChecks').once('value').then((snapshot) => {
  pendingChecks = snapshot.val() || {}
})

database.ref('cryptobotDeposits').once('value').then((snapshot) => {
  cryptobotDeposits = snapshot.val() || {};
})

const adminPanelKeyboard = [
  [
    {text: '🛠 Товары', callback_data: 'manage-products'},
    {text: '💳 Реквизиты', callback_data: 'edit-payment-details'}
  ],
  [
    {text: '📊 Балансы', callback_data: 'manage-balances'},
    {text: '📢 Рассылка', callback_data: 'send-broadcast'}
  ],
  [
    {text: '➕ Коды UC', callback_data: 'manage-codes'},
    {text: '👥 Админы', callback_data: 'manage-admins'}
  ],
  [
    {text: '🔙 На главную', callback_data: 'return'}
  ]
];

const IMAGES = {
  welcome: 'https://ibb.co/jkKsYXRZ',
  pack: 'https://ibb.co/wF0vRw5J',
  payment: 'https://ibb.co/W4VVcZWz',
  amount: 'https://ibb.co/W4VVcZWz'
}


const sendMainMessage = async (chatId, firstName, lastName, messageToEdit = null) => {
  const greetingName = lastName ? `${firstName} ${lastName}` : firstName;
  const inlineKeyboard = [
      [{text: '🛒Купить UC', callback_data: 'open-shop'}],
      [
          {text: '📦Мои заказы', callback_data: 'my-orders'}, 
          {text: '👤Мой профиль', callback_data: 'my-profile'}
      ],
      [
          {text: '🔗Наш канал', url: 'https://t.me/POSTAVKABOJLHOGO'}, 
          {text: '⚙️Тех.поддержка', url: 'https://t.me/BoJlHoy'}
      ]
  ];
  
  if (isAdmin(chatId)) {
      inlineKeyboard.push([{text: '👑 Админ-панель', callback_data: 'admin-panel'}]);
  }

  try {
    const caption = `🙋‍♂ Добрый день, ${greetingName}!\n💰 Ваш текущий баланс - ${userBalances[chatId]}$.`;
    if (messageToEdit) {
      await bot.editMessageMedia({
        type: 'photo',
        media: IMAGES.welcome,
        caption: caption
      }, {
        chat_id: chatId,
        message_id: messageToEdit,
        reply_markup: { inline_keyboard: inlineKeyboard }
      })
    } else {
      await bot.sendPhoto(chatId, IMAGES.welcome, {
          caption: caption,
          reply_markup: { inline_keyboard: inlineKeyboard }
      });
    }
  } catch (error) {
      if (error.response?.statusCode === 403) {
          console.log(`Пользователь ${chatId} заблокировал бота. Удаляем...`);
          delete userBalances[chatId];
          await database.ref(`userBalances/${chatId}`).remove();
      }
  }
};

bot.onText(/\/start(?: (.+))?/, (msg) => {
  const chatId = msg.chat.id;

  try {
    if (!userBalances[chatId]) {
      userBalances[chatId] = 0; // Устанавливаем баланс, если он не был установлен
      
      // Сохраняем нового пользователя в базе данных
      database.ref(`userBalances/${chatId}`).set(userBalances[chatId])
      .catch((error) => {
          console.error(`Error adding user to database: ${error}`);
        });
    }
    
    sendMainMessage(chatId, msg.chat.first_name, msg.chat.last_name)
  } catch (error) {
      if (error.code === 'EFATAL' && error.response?.statusCode === 403) {
        console.log('Бот был заблокирован пользователем');
    } else {
        console.error(`Polling error: ${error}`);
    }
  }

});

// Получаем тег пользователя (имя пользователя или имя)
const getUserTag = (msg) => {
  const username = msg.from.username ? `@${msg.from.username}` : `${msg.from.first_name || 'Пользователь'}`;
  return username;
};

// Обработка сообщений от пользователя
bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userTag = getUserTag(msg); // Получаем тег пользователя
    const cbrData = await getCbrUsdRate();
    const usdRate = cbrData.usdRate

    const replyToMessage = msg.reply_to_message;
  
    // Если сообщение пришло от админа и это ответ на пересланное сообщение
    if (isAdmin(chatId) && replyToMessage) {
      const userId = replyToMessage.forward_from.id;
  
      // Пересылаем ответ админу пользователю
      bot.sendMessage(userId, `Ответ от администратора: ${msg.text}`).then(() => {
        sendMessageToAllAdmins(`Ответ от ${userTag} пользователю с ID ${userId} был отправлен.`)
      });
    }

      // Проверяем что сообщение от CryptoBot в нужной группе
    if (msg.chat.id == DEPOSIT_GROUP_ID && msg.from?.id == CRYPTOBOT_ID) {
      const messageText = msg.text;
      const lines = messageText.split(' ');

      // Парсинг данных из сообщения
      const senderIndex = lines.findIndex(line => line === 'отправил(а)');
      
      // Проверяем структуру сообщения
      if (senderIndex === -1 || 
          senderIndex + 2 >= lines.length || 
          lines[senderIndex + 1] !== '🪙') {
          return bot.sendMessage(DEPOSIT_GROUP_ID, '❌ Ошибка парсинга данных перевода');
      }
  
      // Парсинг данных
      const paymentData = {
          username: lines.slice(0, senderIndex).join(' ').trim(),
          amount: parseFloat(lines[senderIndex + 2].replace(',', '.')), // Убрано округление
          currency: 'USDT'
      };
  
      // Валидация
      if (!paymentData.username || isNaN(paymentData.amount)) {
          return bot.sendMessage(DEPOSIT_GROUP_ID, '❌ Ошибка парсинга данных перевода');
      }
  
      // Поиск соответствующего заказа
      const depositsSnapshot = await database.ref('cryptobotDeposits').once('value');
      const deposits = depositsSnapshot.val() || {};
  
      const [userId, deposit] = Object.entries(deposits).find(([, deposit]) => 
          deposit.username === paymentData.username
      ) || [];

      const messageId = deposit.messageId
  
      if (userId && messageId && deposit) {
        // Удаление записи о депозите
        await database.ref(`cryptobotDeposits/${userId}`).remove();

        // Округление только при наличии "девяток"
        const cleanedAmount = safeRound(paymentData.amount);

        // Обновление баланса
        userBalances[userId] = (userBalances[userId] || 0) + cleanedAmount;
        await database.ref(`userBalances/${userId}`).set(userBalances[userId]);

        // Уведомления
        bot.sendMessage(
            DEPOSIT_GROUP_ID,
            `✅ Перевод ${cleanedAmount} ${paymentData.currency} подтвержден\n` +
            `ID пользователя: ${userId}\n` +
            `Новый баланс: ${userBalances[userId]}`,
            { reply_to_message_id: msg.message_id }
        );

        bot.sendPhoto(userId, IMAGES.welcome, {
          caption:  `💳 Ваш баланс пополнен на ${cleanedAmount} ${paymentData.currency}\n` +
            `Текущий баланс: ${userBalances[userId]}`,
          reply_markup: {
              inline_keyboard: [[{text: '🛒 Открыть магазин', callback_data: 'open-shop'}]]
            }
        })

        await bot.deleteMessage(userId, messageId)
      } else {
        bot.sendMessage(
            DEPOSIT_GROUP_ID,
            `⚠️ Не найден заказ для перевода\n` +
            `Payment ID: ${paymentData.username}\n` +
            `Сумма: ${paymentData.amount} ${paymentData.currency}`,
            { reply_to_message_id: msg.message_id }
        );
      }
    }
  
    // Если бот ждет ID в PUBG
    if (awaitingPubgId[chatId]) {
      const pubgId = text; // Получаем ID пользователя в PUBG
  
      const cart = userCarts[chatId];
  
      const orderNumber = Date.now().toString(36).toUpperCase() + chatId.toString().slice(-4);
  
      // Форматируем список товаров
      const itemsDetails = cart.items.reduce((acc, item) => {
          acc[item.label] = (acc[item.label] || 0) + 1;
          return acc;
      }, {});
  
      const itemsText = Object.entries(itemsDetails)
          .map(([label, count]) => {
              const product = products.find(p => p.label === label);
              return `➥ ${label} UC ×${count} = ${(product.price * count)}$`;
          })
          .join('\n');
  
      // Списание средств
      userBalances[chatId] -= cart.total;
      database.ref(`userBalances/${chatId}`).set(userBalances[chatId]);
  
      const orderData = {
        orderId: orderNumber,
        userId: chatId,
        type: 'id',
        pubgId: pubgId,
        items: cart.items,
        total: cart.total,
        status: 'pending',
        timestamp: Date.now(),
        userInfo: {
            username: getUserTag(msg),
            balanceBefore: userBalances[chatId] + cart.total,
            balanceAfter: userBalances[chatId]
        }
      };
  
      // Сохраняем заказ в Firebase
      try {
          ordersRef.child(chatId).child(orderNumber).set(orderData);
      } catch (error) {
          console.error('Ошибка сохранения заказа:', error);
          return bot.sendMessage(chatId, '❌ Ошибка оформления заказа, попробуйте позже');
    }
      
      // Отправка заказа админам
      const orderText = `✅Новый заказ 
  🧾#${orderNumber} 
  🛍Товары : 
  ${itemsText} 
  💵Стоимость : ${cart.total} 
  🆔 : <code>${pubgId}</code> 
  🪪Пользователь : ${getUserTag(msg)} (ID: ${chatId}) .
  ⚠️Выберите действие ниже`;
      
      sendOrderRequest(orderText, [[
        { text: '✅ Заказ выполнен', callback_data: `order-completed_${chatId}_${orderNumber}` },
        { text: '❌ Отменить заказ', callback_data: `order-declined_${chatId}_${orderNumber}_${cart.total}`}
      ]])
      
      // Очистка корзины
      delete userCarts[chatId];
  
      bot.sendMessage(chatId, '✅ ID успешно отправлен, ожидайте подтверждение администратора', {
        reply_markup: {
          inline_keyboard: [
            [{text: '🔙 В меню', callback_data: 'return'}]
          ]
        }
      });
  
      customersOrders[chatId] = true;
      awaitingPubgId[chatId] = false; // Завершаем ожидание ID в PUBG
      
      return;
    } else if (awaitingDeposit[chatId]) {
      const amount = parseFloat(text); // Преобразуем введенное значение в число

      if (isNaN(amount)) {
        await bot.sendMessage(chatId, 'Вы отправили неккоректную сумму', {
          reply_markup: {
            inline_keyboard: [
              [{text: '❌ Отмена', callback_data: 'my-profile'}]
            ]
          }
        });
        return;
      }
  
      // Отправляем сообщение с реквизитами для перевода
      bot.sendMessage(chatId, `Совершите перевод на указанную вами сумму ⤵️
${paymentDetails.card}
Сумма: ${amount}₽ (${rubToUsd(amount, usdRate)}$)

В ОТВЕТНОМ СООБЩЕНИИ ПРИШЛИТЕ ЧЕК ТРАНЗАКЦИИ`, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{text: '❌ Отмена', callback_data: 'my-profile'}]
      ]
    }
  }
      )
  
      awaitingDeposit[chatId] = false;
      awaitingReceipt[chatId] = {
        amount: amount,
        userTag: userTag,
        userId: chatId
      };
  
      return;
    } else if (awaitingReceipt[chatId]) {
      // Пересылаем чек администратору
      bot.forwardMessage(DEPOSIT_GROUP_ID, chatId, msg.message_id);
      pendingChecks[chatId] = {
        amount: awaitingReceipt[chatId].amount,
        userTag: awaitingReceipt[chatId].userTag,
        userId: chatId,
      }
  
      database.ref('pendingChecks').set(pendingChecks);
      bot.sendMessage(chatId, 'Чек получен и отправлен администратору на проверку. Ожидайте подтверждения.');
  
      sendMainMessage(chatId, msg.chat.first_name, msg.chat.last_name);
      
      // Оповещаем администратора о запросе на проверку чека
      const userInfo = pendingChecks[chatId];
      sendDepositRequest(
        `🆕 Запрос на пополнение баланса\n` +
        `👤 Пользователь: ${userTag} (ID: ${chatId})\n` +
        `💵 Сумма: ${userInfo.amount}₽ (${rubToUsd(userInfo.amount, usdRate)}$)\n` +
        `📅 Время: ${new Date().toLocaleString()}`,
        [
          [
            { text: '✅ Подтвердить', callback_data: `confirm_${chatId}` },
            { text: '❌ Отклонить', callback_data: `reject_${chatId}` }
          ]
        ]
      );
  
      awaitingReceipt[chatId] = false;  // Завершаем ожидание чека
  
      return;
    } else if (awaitingToChangeProduct[chatId]) {
      const product = awaitingToChangeProduct[chatId].product;
      const productId = awaitingToChangeProduct[chatId].productId;
      const newPrice = parseFloat(msg.text);
      if (isNaN(newPrice)) {
          bot.sendMessage(chatId, 'Пожалуйста, введите корректную цену.');
          return;
      }
  
      // Обновляем цену товара
      product.price = newPrice;
      productId.price = newPrice * idCom;
      database.ref('products').set(products)
      .then(() => {
          bot.sendMessage(chatId, `Цена товара ${product.label} была изменена на ${newPrice}$.`);
      })
      .catch((error) => {
          bot.sendMessage(chatId, 'Ошибка сохранения данных в Firebase.');
          console.error(error);
      });
      awaitingToChangeProduct[chatId] = false
      
      return;
    } else if (awaitingNewProductLabel[chatId]) {
      const newLabel = msg.text;
      bot.sendMessage(chatId, `Введите цену для нового товара (${newLabel}): `);
  
      awaitingNewProductLabel[chatId] = false;
      awaitingNewProductPrice[chatId] = {newLabel};
      
      return;
    } else if (awaitingNewProductPrice[chatId]) {
      const newLabel = awaitingNewProductPrice[chatId].newLabel
      const newPrice = parseFloat(msg.text);
      if (isNaN(newPrice)) {
        bot.sendMessage(chatId, 'Пожалуйста, введите корректную цену');
        return;
      }
  
      products.push({label: newLabel, price: newPrice});

      productsId.push({label: newLabel, price: newPrice * idCom})
  
      products.sort((a, b) => {
        return parseInt(a.label, 10) - parseInt(b.label, 10);
      });

      productsId.sort((a, b) => {
        return parseInt(a.label, 10) - parseInt(b.label, 10);
      });
  
  
      database.ref('products').set(products)
      .then(() => {
          bot.sendMessage(chatId, `Новый товар ${newLabel} был добавлен по цене ${newPrice}`);
      })
      .catch((error) => {
          bot.sendMessage(chatId, 'Ошибка сохранения данных в Firebase.');
          console.error(error);
      });
  
      awaitingNewProductPrice[chatId] = false;
      
      return;
    } else if (awaitingToChangeCredentials[chatId]) {
      const method = awaitingToChangeCredentials[chatId];
      const newValue = msg.text;
    
      // Обновляем только выбранный метод
      paymentDetails[method] = newValue;
    
      database.ref('paymentDetails').update(paymentDetails)
        .then(() => {
          bot.sendMessage(chatId, `✅ Реквизиты для ${method} успешно обновлены!`, {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔙 В админ-панель', callback_data: 'admin-panel' }]
              ]
            }
          });
        })
        .catch((error) => {
          bot.sendMessage(chatId, '❌ Ошибка сохранения реквизитов: ' + error.message);
        });
    
      delete awaitingToChangeCredentials[chatId];
      return;
    } else if (awaitingUserToChangeBalance[chatId]) {
      const userId = msg.text; // Получаем ID пользователя
      
      bot.sendMessage(chatId, `Баланс пользователя ${userBalances[userId]}. Введите новую сумму для баланса:`);
  
      awaitingToChangeBalance[chatId] = {userId}
      awaitingUserToChangeBalance[chatId] = false
      
      return;
    } else if (awaitingToChangeBalance[chatId]) {
      const newBalance = parseFloat(msg.text); // Получаем новую сумму
      const userId = awaitingToChangeBalance[chatId].userId
  
      if (isNaN(newBalance)) {
        bot.sendMessage(chatId, 'Пожалуйста, введите корректную сумму.');
        return;
      }
  
      if (userBalances[userId] || userBalances[userId] === 0) {
        userBalances[userId] = newBalance; // Обновляем баланс пользователя
        database.ref('userBalances').set(userBalances)
          .then(() => {
            bot.sendMessage(chatId, `Баланс пользователя с ID ${userId} был изменен на ${newBalance}$.`, {
              reply_markup: {
                inline_keyboard: [
                  [{text: '🔙 Назад', callback_data: 'return'}]
                ]
              }
            });
          })
          .catch((error) => {
            bot.sendMessage(chatId, 'Ошибка сохранения данных в Firebase.');
            console.error(error);
          });
      } else {
        bot.sendMessage(chatId, 'Пользователя с таким id нет.')
      }
  
      awaitingToChangeBalance[chatId] = false
      
      return;
    } else if (awaitingToCreateMailing[chatId]) {
        const broadcastMessage = msg.text;
        
        if (!broadcastMessage) {
          return bot.sendMessage(chatId, 'Сообщение не может быть пустым.');
        }
  
        const sendBroadcastMessage = async () => {
          if (!userBalances) {
            return bot.sendMessage(chatId, 'Нет пользователей для рассылки.');
          }
  
          // Разослать сообщение каждому пользователю
          const userIds = Object.keys(userBalances);
          for (const userId of userIds) {
            try {
              await bot.sendMessage(userId, broadcastMessage);
            } catch (error) {
              // Если ошибка связана с превышением лимита запросов, обрабатываем её
              if (error.response && error.response.statusCode === 429) {
                const retryAfter = error.response.body.parameters.retry_after || 1;
                console.log(`Превышен лимит запросов, повтор через ${retryAfter} секунд...`);
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
              }
            }
        
            // Добавляем задержку между сообщениями, чтобы не превысить лимит Telegram
            await new Promise(resolve => setTimeout(resolve, 100));
          }
  
          bot.sendMessage(chatId, `Сообщение успешно отправлено ${userIds.length} пользователям.`, {
            reply_markup: {
              inline_keyboard: [
                [{text: '🔙 Назад', callback_data: 'return'}]
              ]
            }
          });
        };
  
        sendBroadcastMessage();
  
        awaitingToCreateMailing[chatId] = false;
        return;
    } else if (awaitingToAddAdmin[chatId]) {
      const newAdminId = msg.text;
      if (!Object.prototype.hasOwnProperty.call(userBalances, newAdminId)) {
        bot.sendMessage(chatId, `Пользователь с ID "${newAdminId}" не существует. Пожалуйста, проверьте введенный ID и попробуйте еще раз. Возможно пользователь не зарегистрирован в боте`);
        return;
      }
      if (!admins[newAdminId]) {
        // Добавляем нового администратора в список
        admins[newAdminId] = true;
        database.ref('admins').set(admins)
          .then(() => {
            bot.sendMessage(chatId, `Пользователь с ID ${newAdminId} добавлен как администратор.`, {
              reply_markup: {
                inline_keyboard: [
                  [{text: '🔙 Назад', callback_data: 'return'}]
                ]
              }
            });
            bot.sendMessage(newAdminId, 'Вы были добавлены в качестве администратора.', {
              reply_markup: {
                inline_keyboard: [
                  [{text: '🔙 Назад', callback_data: 'return'}]
                ]
              }
            });
          })
          .catch((error) => {
            bot.sendMessage(chatId, `Произошла ошибка: ${error.message}`, {
              reply_markup: {
                inline_keyboard: [
                  [{text: '🔙 Назад', callback_data: 'return'}]
                ]
              }
            });
          });
      } else {
        bot.sendMessage(chatId, `Пользователь с ID ${newAdminId} уже является администратором.`, {
          reply_markup: {
            inline_keyboard: [
              [{text: '🔙 Назад', callback_data: 'return'}]
            ]
          }
        });
      }
  
      awaitingToAddAdmin[chatId] = false;
      
      return;
    } else if (awaitingToRemoveAdmin[chatId]) {
      const adminIdToRemove = msg.text;
            
      // Проверяем, что этот пользователь действительно является администратором
      if (admins[adminIdToRemove]) {
        if (adminIdToRemove === ADMIN_CHAT_ID) {
          bot.sendMessage(chatId, 'Нельзя удалить главного администратора');
        } else {
          // Удаляем администратора из списка
          delete admins[adminIdToRemove];
          database.ref('admins').set(admins)
              .then(() => {
                  bot.sendMessage(chatId, `Пользователь с ID ${adminIdToRemove} был удален из списка администраторов.`, {
                    reply_markup: {
                      inline_keyboard: [
                        [{text: '🔙 Назад', callback_data: 'return'}]
                      ]
                    }
                  });
                  bot.sendMessage(adminIdToRemove, 'Вы были удалены из списка администраторов.', {
                    reply_markup: {
                      inline_keyboard: [
                        [{text: '🔙 Назад', callback_data: 'return'}]
                      ]
                    }
                  });
              })
              .catch((error) => {
                  bot.sendMessage(chatId, `Произошла ошибка: ${error.message}`, {
                    reply_markup: {
                      inline_keyboard: [
                        [{text: '🔙 Назад', callback_data: 'return'}]
                      ]
                    }
                  });
              });
        }
      } else {
          bot.sendMessage(chatId, `Пользователь с ID ${adminIdToRemove} не является администратором.`, {
            reply_markup: {
              inline_keyboard: [
                [{text: '🔙 Назад', callback_data: 'return'}]
              ]
            }
          });
      }
  
      awaitingToRemoveAdmin[chatId] = false;
      
      return;
    } else if (isAdmin(chatId) && awaitingCodesForProduct[chatId]) {
        const productLabel = awaitingCodesForProduct[chatId];
        const codes = text.split('\n')
          .map(code => code.trim())
          .filter(code => code.length > 0);
    
        const updates = {};
        codes.forEach(code => {
          const newCodeRef = productCodesRef.child(productLabel).push();
          updates[newCodeRef.key] = {
            code: code,
            used: false,
            addedAt: Date.now()
          };
        });
    
        database.ref(`codes/${productLabel}`).update(updates)
          .then(() => {
            bot.sendMessage(chatId, `✅ Добавлено ${codes.length} кодов для ${productLabel} UC`, {
              reply_markup: {
                inline_keyboard: [
                  [{text: '🔙 Назад', callback_data: 'return'}]
                ]
              }
            });
            delete awaitingCodesForProduct[chatId];
          })
          .catch(error => {
            bot.sendMessage(chatId, `❌ Ошибка сохранения кодов: ${error.message}`);
          });
        return;
      }
  } catch (error) {
    if (error.code === 'EFATAL' && error.response?.statusCode === 403) {
      console.log('Бот был заблокирован пользователем');
    } else {
        console.error(`Polling error: ${error}`);
    }
  }
});

// Обработка нажатий на inline-кнопки
bot.on('callback_query', async (query) => {
  try {

    const chatId = query.message.chat.id;
    const data = query.data;
    const messageId = query.message.message_id
    const cbrData = await getCbrUsdRate()
    const usdRate = cbrData.usdRate
  
    if (userBalances[chatId] === undefined) {
      userBalances[chatId] = 0;  // Устанавливаем начальный баланс для новых пользователей
    }
  
    // Проверяем нажатие на кнопки администратора
    if (data === 'return') {
      // Сбрасываем все ожидания
      awaitingPubgId[chatId] = false;
      awaitingDeposit[chatId] = false;
      awaitingReceipt[chatId] = false;
      awaitingDeposit[chatId] = false;
      awaitingReceipt[chatId] = false;
      awaitingPubgId[chatId] = false;
      awaitingToChangeProduct[chatId] = false;
      awaitingNewProductLabel[chatId] = false;
      awaitingNewProductPrice[chatId] = false;
      awaitingToChangeCredentials[chatId] = false;
      awaitingUserToChangeBalance[chatId] = false;
      awaitingToChangeBalance[chatId] = false;
      awaitingToCreateMailing[chatId] = false;
      awaitingToAddAdmin[chatId] = false;
      awaitingToRemoveAdmin[chatId] = false;
      cryptobotDeposits[chatId] = false;
      database.ref('cryptobotDeposits').set(cryptobotDeposits);
  
      // Возвращаем главное меню
      sendMainMessage(chatId, query.message.chat.first_name, query.message.chat.last_name, messageId);
      
      return;
    } else if (data === 'open-shop') {
      await bot.editMessageCaption('Выберите каким способом вы хотите получить UC', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {inline_keyboard: [
          [{text: 'Получить кодами', callback_data: 'open-shop-codes'}],
          [{text: 'Получить по id', callback_data: 'open-shop-id'}],
          [{text: '🔙 Назад', callback_data: 'return'}]
        ]}
      })
  
      return;
    } else if (data === 'open-shop-codes') {
      const inlineKeyboard = await generateShopKeyboard(userCarts[chatId], 'codes')
      await bot.editMessageMedia({
        type: 'photo',
        media: IMAGES.pack,
        caption: generateCartText(userCarts[chatId]),
        parse_mode: 'HTML'
      }, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      });
    } else if (data === 'open-shop-id') {
      const inlineKeyboard = await generateShopKeyboard(userCarts[chatId], 'id')
      await bot.editMessageMedia({
        type: 'photo',
        media: IMAGES.pack,
        caption: generateCartText(userCarts[chatId]),
        parse_mode: 'HTML'
      }, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      });
    } else if (data === 'admin-panel') {
      if (!isAdmin(chatId)) {
        await bot.answerCallbackQuery(query.id, {text: '❌ Доступ запрещен!'});
        return;
      }
        // Сбрасываем все ожидания
        awaitingPubgId[chatId] = false;
        awaitingDeposit[chatId] = false;
        awaitingReceipt[chatId] = false;
        awaitingDeposit[chatId] = false;
        awaitingReceipt[chatId] = false;
        awaitingPubgId[chatId] = false;
        awaitingToChangeProduct[chatId] = false;
        awaitingNewProductLabel[chatId] = false;
        awaitingNewProductPrice[chatId] = false;
        awaitingToChangeCredentials[chatId] = false;
        awaitingUserToChangeBalance[chatId] = false;
        awaitingToChangeBalance[chatId] = false;
        awaitingToCreateMailing[chatId] = false;
        awaitingToAddAdmin[chatId] = false;
        awaitingToRemoveAdmin[chatId] = false;
        cryptobotDeposits[chatId] = false;
        database.ref('cryptobotDeposits').set(cryptobotDeposits);
  
        await bot.editMessageMedia({
          type: 'photo',
          media: IMAGES.welcome,
          caption: `🙋‍♂ Добрый день, ${query.message.chat.first_name} ${query.message.chat.last_name}!
💰 Ваш текущий баланс - ${userBalances[chatId]}$.`
        }, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: adminPanelKeyboard
          }
        });

      return;
  
    } else if (data === 'manage-products') {
      const productsManagementKeyboard = (products) => {
        const buttons = products.map(p => ({
          text: `${p.label} UC - ${p.price}$`,
          callback_data: `edit-product_${p.label}`
        }));
        
        const chunks = [];
        while (buttons.length) chunks.push(buttons.splice(0, 2));
        
        chunks.push(
          [{text: '➕ Добавить товар', callback_data: 'add-product'}, {text: '➖ Удалить товар', callback_data: 'delete-product'}],
          [{text: '🔙 Назад', callback_data: 'admin-panel'}]
        );
        
        return chunks;
      };

      await bot.editMessageCaption('🛠 Управление товарами:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {inline_keyboard: productsManagementKeyboard(products)}
      });
  
      return;
    } else if (data === 'edit-payment-details') {
      await bot.editMessageCaption('Выберите способ оплаты для редактирования:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'ByBit', callback_data: 'select-payment-method_ByBit' },
              { text: 'CryptoBot', callback_data: 'select-payment-method_CryptoBot' }
            ],
            [{ text: '❌ Отмена', callback_data: 'admin-panel' }]
          ]
        }
      });

    return;
    } else if (data.startsWith('select-payment-method_')) {
      const method = data.split('_')[1];
      awaitingToChangeCredentials[chatId] = method;

      await bot.editMessageCaption(`Введите новые реквизиты для ${method}:`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Отмена', callback_data: 'admin-panel' }]
          ]
        }
      });

      return;
    } else if (data === 'manage-balances') {
      awaitingUserToChangeBalance[chatId] = true;

      await bot.editMessageCaption('Введите ID пользователя, чей баланс вы хотите изменить:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'admin-panel'}]]}
      })
  
      return;
    } else if (data === 'add-product') {
      awaitingNewProductLabel[chatId] = true;

      await bot.editMessageCaption('Введите название нового товара:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'admin-panel'}]]}
      })
  
      return;
    } else if (data === 'delete-product') {
      const productButtons = products.map(product => ({
        text: `${product.label} UC - ${product.price}$`,  // Отображаем метку и имя товара
        callback_data: `delete-product_${product.label}`  // Уникальный callback_data для каждого товара
      }));
  
      // Разбиваем кнопки на строки по 2 кнопки в каждой строке
      const deleteProductsKeyboard = [];
      for (let i = 0; i < productButtons.length; i += 2) {
        deleteProductsKeyboard.push(productButtons.slice(i, i + 2));
      }
      deleteProductsKeyboard.push([{text: '❌ Отмена', callback_data: 'admin-panel'}])

      await bot.editMessageCaption('Выберите товар, который хотите удалить:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: deleteProductsKeyboard
        }
      });
  
      return;
    } else if (data === 'manage-admins') {
      await bot.editMessageCaption('👥 Управление администраторами:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [
              {text: '➕ Добавить', callback_data: 'add-admin'},
              {text: '➖ Удалить', callback_data: 'remove-admin'}
            ],
            [{text: '🔙 Назад', callback_data: 'admin-panel'}]
          ]
        }
      });
  
      return;
    } else if (data === 'send-broadcast') {
      if (!isAdmin(chatId)) {
        return; 
      }
    
      bot.sendMessage(chatId, 'Отправьте текст сообщения, которое хотите разослать всем пользователям:', {
        reply_markup: {
          inline_keyboard: [
            [{text: '⛔️ Назад', callback_data: 'admin-panel'}]
          ]
        }
      });
      
      awaitingToCreateMailing[chatId] = true;
      
      return;
    } else if (data === 'add-admin') {
      bot.editMessageCaption('Введите ID пользователя, которого хотите сделать администратором', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{text: '⛔️ Назад', callback_data: 'admin-panel'}]
          ]
        }
      })
  
      awaitingToAddAdmin[chatId] = true;
    } else if (data === 'remove-admin') {
      bot.editMessageCaption('Введите ID администратора, которого хотите удалить', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{text: '⛔️ Назад', callback_data: 'admin-panel'}]
          ]
        }
      })
  
      awaitingToRemoveAdmin[chatId] = true;
  
    }  else if (data === 'my-profile') {
      await bot.editMessageMedia({
        type: 'photo',
        media: IMAGES.welcome,
        caption: `<b>✦ Ваш профиль!
👤Пользователь : <code>${chatId}</code> 
💳Баланс : <u>${userBalances[chatId]}$</u></b>`,
        parse_mode: 'HTML'
      }, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{text: '💳Пополнить баланс', callback_data: 'deposit'}],
            [{ text: '🛒Купить UC', callback_data: 'open-shop'}],
            [{text: 'Наш канал', url: 'https://t.me/POSTAVKABOJLHOGO'}, {text: 'Тех.поддержка', url: 'https://t.me/BoJlHoy'}],
            [{text: '⛔️Назад', callback_data: 'return'}]
          ]
        }
      })
    } else if (data === 'my-orders') {
      try {
        const snapshot = await ordersRef.child(chatId).once('value');
        const orders = snapshot.val();
        
        if (!orders) {
            return bot.sendMessage(chatId, '📭 У вас еще нет заказов');
        }
        
        const ordersList = Object.entries(orders)
            .map(([orderId, order]) => {
                let details = '';
                if (order.type === 'codes') {
                    // Форматируем коды для отображения
                    const codesText = Object.entries(order.codes)
                        .map(([label, codes]) => `➥ ${label} UC:\n${codes.join('\n')}`)
                        .join('\n\n');
                    details = `\n🔑 Полученные коды:\n${codesText}`;
                } else {
                    details = `\n🆔 Игровой ID: ${order.pubgId}`;
                }
                
                return `🆔 Заказ #${orderId}
📅 Дата: ${new Date(order.timestamp).toLocaleDateString()}
🛍 Товаров: ${order.items.length}
💵 Сумма: ${order.total}$
📊 Статус: ${getStatusEmoji(order.status)} ${order.status}
${details}`;
            })
            .join('\n\n────────────────\n');

        bot.sendMessage(chatId, `📋 История ваших заказов:\n\n${ordersList}`, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{text: '🔙 Назад', callback_data: 'return'}]
            ]
          }
        })

        bot.deleteMessage(chatId, messageId)
        
      } catch (error) {
          console.error('Ошибка получения заказов:', error);
          bot.sendMessage(chatId, '❌ Ошибка загрузки истории заказов');
      };
    
      function getStatusEmoji(status) {
        switch(status) {
            case 'confirmed': return '✅';
            default: return '⏳';
        }
      }
    } else if (data.startsWith('confirm_')) {
      const userId = data.split('_')[1];
      const userInfo = pendingChecks[userId];
  
      if (!isAdmin(query.from.id)) {
        return
      }
  
      if (userInfo) {
        const depositAmount = userInfo.amount;
        const usdDepositAmount = rubToUsd(depositAmount, usdRate)
  
        // Обновляем баланс пользователя
        userBalances[userId] = (userBalances[userId] || 0) + usdDepositAmount;
  
        database.ref('userBalances').set(userBalances);
  
        // Оповещаем администратора и пользователя
        sendDepositRequest(`Пополнение на ${usdDepositAmount}$ для ${userInfo.userTag} (ID: ${userId}) подтверждено.`)
        bot.sendMessage(userId, `Ваш баланс был пополнен на ${usdDepositAmount}$. Текущий баланс: ${userBalances[userId]}$.`);
  
        // Очищаем информацию о запросе
        delete pendingChecks[userId];
        database.ref('pendingChecks').set(pendingChecks);
      }
      
      return;
    } else if (data.startsWith('cart_')) {
      const action = data.split('_')[1];
      const type = data.split('_')[2]
        
        switch(action) {
          case 'clear':
            delete userCarts[chatId];
            await updateCartMessage(chatId, messageId, type);
            break;
            
          case 'buy-with-id':
            await purchaseWithId(chatId, messageId);
            break;
            
          case 'buy-codes':
            await purchaseCodes(chatId, messageId, query.message.chat.first_name, query.message.chat.last_name)
            break;
        }
        return;
    } else if (data.startsWith('add-to-cart_')) {
      const [, label, price, type] = data.split('_');
      const product = products.find(p => p.label === label);
      
      if (!userCarts[chatId]) {
        userCarts[chatId] = {
          items: [],
          total: 0
        };
      }
      
      userCarts[chatId].items.push(product);
      userCarts[chatId].total = Math.round((userCarts[chatId].total + parseFloat(price)) * 100) / 100;
      
      await updateCartMessage(chatId, messageId, type);
      return;
    } else if (data.startsWith('reject_')) {
      const userId = data.split('_')[1];
      const userInfo = pendingChecks[userId];
  
      if (!isAdmin(query.from.id)) {
        return
      }
  
      if (userInfo) {
        // Оповещаем администратора и пользователя об отмене
        sendDepositRequest(`Пополнение на ${userInfo.amount}$ для ${userInfo.userTag} (ID: ${userId}) отменено.`)
        bot.sendMessage(userId, `Ваше пополнение на сумму ${userInfo.amount}$ было отклонено. Пожалуйста, попробуйте снова.`);
  
        // Очищаем информацию о запросе
        delete pendingChecks[userId];
        database.ref('pendingChecks').set(pendingChecks);
      }
      
      return;
    } else if (data.startsWith('buy_')) {
      const [, label, price] = data.split('_');; // Получаем метку товара (например, 60)
      const numericPrice = Number(price);
      
      // Запросить у пользователя его ID в PUBG
      bot.sendMessage(chatId, `Вы выбрали товар: ${label}UC за ${numericPrice}$. Пожалуйста, введите ваш ID в PUBG:`);
      
      // Сохраняем информацию о покупке и ожидаем ввода PUBG ID
      awaitingPubgId[chatId] = { label, price: numericPrice }; // Пример логики цены
      awaitingDeposit[chatId] = false; // Остановить ожидание депозита, если оно было активным
      
      return;
    } else if (data.startsWith('order-completed_')) {
      const [, userId, orderId] = query.data.split('_'); // Получаем ID покупателя из callback_data
      const message = query.message;
  
      if (!isAdmin(query.from.id)) {
        return
      }
  
      try {
        await ordersRef.child(userId).child(orderId).update({
            status: 'confirmed',
            confirmedAt: Date.now(),
            adminId: query.from.id
        });
  
        if (customersOrders[userId]) {
            // Сообщаем администратору о выполнении заказа
            sendOrderRequest(`Заказ для пользователя с ID ${userId} был выполнен.`)
        
            // Сообщаем покупателю, что его заказ выполнен
            bot.sendMessage(userId, '✅Заказ выполнен', {reply_markup: {
              inline_keyboard: [
                [{text: '🔙 В главное меню', callback_data: 'return'}]
              ]
            }});
        
            bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
              chat_id: message.chat.id,
              message_id: message.message_id,
            });
        }
      } catch (error) {
        console.error('Ошибка подтверждения заказа: ', error)
      }
  
  
      return;
    } else if (data.startsWith('order-declined_')) {
      const [, userId, orderId, amount] = query.data.split('_'); // Получаем ID покупателя из callback_data
      const message = query.message;

      if (!isAdmin(query.from.id)) {
        return
      }
  
      try {
        await ordersRef.child(userId).child(orderId).update({
            status: 'declined',
            confirmedAt: Date.now(),
            adminId: query.from.id
        });
  
        if (customersOrders[userId]) {
            // Сообщаем администратору о выполнении заказа

            userBalances[userId] += Math.round(parseFloat(amount) * 100) / 100;

            sendOrderRequest(`❌ Заказ для пользователя с ID ${userId} был отменен.`)
        
            // Сообщаем покупателю, что его заказ выполнен
            bot.sendMessage(userId, '⛔️Ваш заказ отклонён, причину узнайте у администратора', {reply_markup: {
              inline_keyboard: [
                [{text: '🔙 В главное меню', callback_data: 'return'}]
              ]
            }});
        
            bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
              chat_id: message.chat.id,
              message_id: message.message_id,
            });
        }
      } catch (error) {
        console.error('Ошибка отмены заказа: ', error)
      }

      return;
    } else if (data.startsWith('edit-product_')) {
      const label = data.replace('edit-product_', '');
  
      if (!isAdmin(query.from.id)) {
        return
      }
  
      // Проверка наличия товара
      const product = products.find(p => p.label === label);
      const productId = productsId.find(p => p.label === label);
      if (!product) {
          bot.sendMessage(chatId, `Товар с меткой ${label} не найден.`);
          return;
      }
  
      bot.sendMessage(chatId, `Введите новую цену для товара ${label} UC:`);
  
      awaitingToChangeProduct[chatId] = {product, productId}
  
      return;
    } else if (data.startsWith('delete-product_')) {
      const labelToDelete = data.replace('delete-product_', '');
  
      if (!isAdmin(query.from.id)) {
        return
      }
  
      // Проверка наличия товара
      const product = products.find(p => p.label === labelToDelete);
      if (!product) {
          bot.sendMessage(chatId, `Товар с меткой ${labelToDelete} не найден.`);
          return;
      }
  
      const index = products.findIndex(product => product.label === labelToDelete);
  
    // Проверяем, найден ли товар
      if (index !== -1) {
        // Удаляем товар из массива
        products.splice(index, 1);
        productsId.splice(index, 1)
        database.ref('products').set(products)
        .then(() => {
            bot.sendMessage(chatId, `Товар ${labelToDelete}UC был удален.`);
        })
        .catch((error) => {
            bot.sendMessage(chatId, 'Ошибка сохранения данных в Firebase.');
            console.error(error);
        });
      } else {
        bot.sendMessage(chatId, `Товар ${labelToDelete}UC не найден.`);
      }
  
      sendMainMessage(chatId, query.message.chat.first_name, query.message.chat.last_name);
  
      return;
    } else if (data === 'manage-codes') {
      const productsKeyboard = products.map(p => ({
        text: `${p.label} UC`,
        callback_data: `add-codes_${p.label}`
      }));
      
      const chunks = [];
      while (productsKeyboard.length > 0) {
        chunks.push(productsKeyboard.splice(0, 2));
      }
      chunks.push([{text: '🔙 Назад', callback_data: 'admin-panel'}]);

      await bot.editMessageCaption('Выберите товар для добавления кодов:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: chunks }
      })
  
    } else if (data.startsWith('add-codes_')) {
      const productLabel = data.split('_')[1];
      awaitingCodesForProduct[chatId] = productLabel;
    
      // Получаем текущие неиспользованные коды для этого продукта
      try {
        const unusedCodesSnapshot = await database.ref(`codes/${productLabel}`)
          .orderByChild('used')
          .equalTo(false)
          .once('value');
    
        const unusedCodes = unusedCodesSnapshot.val() || {};
    
        // Форматируем список неиспользованных кодов
        let unusedCodesMessage = `📋 Текущие неиспользованные коды для ${productLabel} UC:\n`;
    
        Object.values(unusedCodes).forEach((codeData, index) => {
          unusedCodesMessage += `${index + 1}. <code>${codeData.code}</code>\n`;
        });
    
        // Отправляем сообщение с неиспользованными кодами
        await bot.sendMessage(chatId, unusedCodesMessage, {
          parse_mode: 'HTML'
        });
    
      } catch (error) {
        console.error('Ошибка получения кодов:', error);
        await bot.sendMessage(chatId, '❌ Ошибка при получении неиспользованных кодов');
      }
    
      // Запрашиваем новые коды
      await bot.editMessageCaption(`Отправьте коды для ${productLabel} UC (по одному в строке):`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'manage-codes' }]] }
      })

    } else if (data === 'deposit') {
      // Бот запрашивает сумму для пополнения
      bot.editMessageMedia({
        type: 'photo',
        media: IMAGES.payment,
        caption: `Курс ЦБ РФ: 1$ = ${usdRate}₽
Выберите способ оплаты`
      }, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{text: 'Перевод по карте', callback_data: 'deposit-with-card'}],
            [{text: '🔹CryptoBot', callback_data: 'deposit-with-cryptobot'}],
            [{text: '❌ Отмена', callback_data: 'my-profile'}]
          ]
        }
      })
      
      return;
    } else if (data === 'deposit-with-card') {
      await bot.editMessageMedia({
        type: 'photo',
        media: IMAGES.amount,
        caption: 'Отправьте сумму, на которую хотите пополнить баланс (в рублях): '
      }, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{text: '❌ Отмена', callback_data: 'my-profile'}]
          ]
        }
      })
  
      awaitingDeposit[chatId] = true;  // Ожидание суммы для пополнения
      
      return
    } else if (data === 'deposit-with-cryptobot') {
      await bot.editMessageMedia({
        type: 'photo',
        media: IMAGES.amount,
        caption: '<b>➤ Оплатите счёт ниже на сумму которую хотите внести! </b>',
        parse_mode: 'HTML',
      }, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{text: '➡️Счет для оплаты', url: 'http://t.me/send?start=IVie9kIYDi8I'}],
            [{text: '❌ Отмена', callback_data: 'my-profile'}]
          ]
        }
      }
      )
  
      // Собираем полное имя пользователя
      const firstName = query.message.chat.first_name || '';
      const lastName = query.message.chat.last_name || '';
      const fullName = `${firstName}${lastName ? ' ' + lastName : ''}`.trim();
  
      cryptobotDeposits[chatId] = {
          userId: chatId,
          messageId: messageId,
          username: fullName // Теперь содержит "Имя Фамилия" или только "Имя"
      };
  
      database.ref('cryptobotDeposits').set(cryptobotDeposits);
    
        return;
    }
  } catch (error) {
    if (error.code === 'EFATAL' && error.response?.statusCode === 403) {
      console.log('Бот был заблокирован пользователем');
    } else {
        console.error(`Polling error: ${error}`);
    }
  }
});

// Запуск бота
// app.listen(port, () => {
//   console.log(`Server is running on port ${port}`);
// });