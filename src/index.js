// eslint-disable-next-line no-undef
require('dotenv').config();
// eslint-disable-next-line no-undef
const express = require('express');
const app = express();
// eslint-disable-next-line no-undef
const axios = require('axios');

app.use(express.json());

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
// eslint-disable-next-line no-undef
const PORT = process.env.PORT;
const bot = new TelegramApi(token, {polling: true});

app.post(`/bolnoy_diller`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Bot server running on port ${PORT}`);

// eslint-disable-next-line no-undef
  const certPath = process.env.CERT_PATH;
  bot.setWebHook(`https://45.11.92.151:8443/bolnoy_diller`, {
    certificate: certPath
  }).then(() => {
    console.log('Webhook set successfully');
  });
});

bot.on('polling_error', (error => {
  console.error('Polling error: ', error.code, error.message);
}))

bot.on('error', (error) => {
  console.error('Bot error: ', error.code, error.message);
})

// eslint-disable-next-line no-undef
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception: ', error); 
})

// eslint-disable-next-line no-undef
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at: ', promise, 'reason: ', reason);
})

const firebaseConfig = {
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://bolnoy-shop-default-rtdb.europe-west1.firebasedatabase.app"
};

admin.initializeApp(firebaseConfig);

const database = admin.database();

// eslint-disable-next-line no-undef
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
// eslint-disable-next-line no-undef
const DEPOSIT_GROUP_ID = process.env.DEPOSIT_GROUP_ID;
// eslint-disable-next-line no-undef
const ORDERS_GROUP_ID = process.env.ORDERS_GROUP_ID;
// eslint-disable-next-line no-undef
const CRYPTOBOT_ID = process.env.CRYPTOBOT_ID;

let admins = {};
database.ref('admins').once('value').then((snapshot) => {
  admins = snapshot.val() || {};
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

function capitalizeFirstLetter(string) {
return string.charAt(0).toUpperCase() + string.slice(1);
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
    CryptoBot: 'http://t.me/send?start=IVGW3jJOOu59',
    ByBit: '414616282'
  };
});

let productsCodes = [];
let productsId = [];

database.ref('productsCodes').once('value').then((snapshot) => {
  productsCodes = snapshot.val() || [  { label: '60', price: 0.86 },
    { label: '325', price: 4.30 },
    { label: '660', price: 8.45 },
    { label: '1800', price: 21.50 },
    { label: '3850', price: 42.00 },
    { label: '8100', price: 81.50 },
  ];
});

database.ref('productsId').once('value').then((snapshot) => {
  productsId = snapshot.val() || [];
})

let productsPopularity = [];

database.ref('productsPopularity').once('value').then((snapshot) => {
  productsPopularity = snapshot.val() || [];
})

let productsSubs = [];

database.ref('productsSubs').once('value').then((snapshot) => {
  productsSubs = snapshot.val() || [];
})

let userBalances = {};

database.ref('userBalances').once('value').then((snapshot) => {
  userBalances = snapshot.val() || {};
});

const userCarts = {};

async function getCbrUsdRate() {
  try {
    const response = await axios.get('https://www.cbr-xml-daily.ru/daily_json.js');
    const usdRate = Math.round((response.data.Valute.USD.Value * 1.06) * 100) / 100;
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

const getCurrentProducts = (type) => {
  switch (type) {
    case 'id':
      return productsId;
    case 'codes':
      return productsCodes;
    case 'popularity':
      return productsPopularity;
    case 'subs':
      return productsSubs;
  }
}

const updateProducts = async (type, newProducts) => {
  switch (type) {
    case 'id':
      productsId = newProducts;
      break;
    case 'codes':
      productsCodes = newProducts;
      break;
    case 'popularity':
      productsPopularity = newProducts;
      break;
    case 'subs':
      productsSubs = newProducts;
      break;
  }

  await database.ref(`products${capitalizeFirstLetter(type)}`).set(newProducts);
}

const generateShopKeyboard = async (cart, type) => {
  const prods = getCurrentProducts(type);
  
  let counts = {};
  if (cart) {
    counts = cart.items.reduce((acc, item) => {
      acc[item.label] = (acc[item.label] || 0) + 1;
      return acc;
    }, {});
  }

  let availableCodes = {};
  if (type === 'codes') {
    try {
      const codesSnapshot = await database.ref('codes').once('value');
      const codesData = codesSnapshot.val() || {};
      
      Object.entries(codesData).forEach(([productLabel, productCodes]) => {
        Object.values(productCodes).forEach(codeObj => {
          if (codeObj.used === false && codeObj.code) {
            availableCodes[productLabel] = (availableCodes[productLabel] || 0) + 1;
          }
        });
      });
    } catch (error) {
      console.error('Error counting codes:', error);
    }
  }

  const buttons = prods.map(p => {
    const inCart = counts ? counts[p.label] || 0 : 0;
    
    let buttonText;
    if (type === 'codes') {
      const available = availableCodes[p.label] || 0;
      buttonText = `${p.label} - ${p.price}$ (${inCart}/${available})`;
    } else {
      buttonText = `${p.label} - ${p.price}$ (×${inCart})`;
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
  } else {
    rows.push([{ text: '🛒 Купить по ID', callback_data: `cart_buy-with-id_${type}` }])
  }

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
  const caption = generateCartText(cart, type);
  const keyboard = { inline_keyboard: await generateShopKeyboard(cart, type) };

  try {
    if (messageId) {
      await bot.editMessageCaption(caption, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
      return messageId;
    }
  } catch (editError) {
    if (editError.response?.description.includes('message to edit not found')) {
      return await sendNewCartMessage(chatId, caption, keyboard);
    }
  }

  return await sendNewCartMessage(chatId, caption, keyboard);
}

async function sendNewCartMessage(chatId, caption, keyboard) {
  try {
    const sentMessage = await bot.sendPhoto(chatId, IMAGES.pack, {
      caption: caption,
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
    
    return sentMessage.message_id;

  } catch (photoError) {
    console.error('Ошибка отправки фото:', photoError.message);
    
    const sentMessage = await bot.sendMessage(chatId, caption, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
    
    return sentMessage.message_id;
  }
}

function generateCartText(cart, type) {
  if (!cart) {
    return `<b>➤ Выберите товар для покупки (можно несколько) 
🛒 Ваша корзина пуста</b>\n`;
  }

  const itemsCount = cart.items.reduce((acc, item) => {
    acc[item.label] = (acc[item.label] || 0) + 1;
    return acc;
  }, {});
  
  const itemsText = Object.entries(itemsCount)
    .map(([label, count]) => `<b>➥ ${label} × ${count} = ${Math.round(count * getCurrentProducts(type).find(p => p.label === label).price * 100) / 100 }$</b>`)
    .join('\n');
  
  return `<b>➤ Выберите товар для покупки (можно несколько)
🛒 Ваша корзина:\n\n${itemsText}\n\n✦ Итого: <u>${cart.total}$</u></b>`;
}

async function purchaseWithId(chatId, messageId, type) {
  const cart = userCarts[chatId];
  
  if (!cart || cart.items.length === 0) {
    return;
  }
  
  if (userBalances[chatId] < cart.total) {
    await bot.sendMessage(chatId, '❌ Недостаточно средств! Пополните свой баланс.', {
      reply_markup: {
        inline_keyboard: [[{text: '💳Пополнить баланс', callback_data: 'deposit'}],]
      }
    })
    return;
  }

  awaitingPubgId[chatId] = {
    cart: cart,
    type: type
  };

  await bot.editMessageCaption('✦ Отправьте игровой ID для зачисления товара! ', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: {
      inline_keyboard: [
        [{text: '🔙 В меню', callback_data: 'return'}]
      ]
    }
  })
}

const purchaseCodes = async (chatId, messageId, firstName, lastName) => {
  const cart = userCarts[chatId];
  if (!cart || cart.items.length === 0) {
    await bot.sendMessage(chatId, '❌ Корзина пуста!');
    return;
  }

  if (userBalances[chatId] < cart.total) {
    await bot.sendMessage(chatId, '❌ Недостаточно средств! Пополните баланс.', {
      reply_markup: {
        inline_keyboard: [[{text: '💳Пополнить баланс', callback_data: 'deposit'}]]
      }
    });
    return;
  }

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

  const codesToSend = {};
  for (const label of Object.keys(requiredCodes)) {
    const snapshot = await database.ref(`codes/${label}`)
      .orderByChild('used')
      .equalTo(false)
      .limitToFirst(requiredCodes[label])
      .once('value');

    const codes = snapshot.val();
    codesToSend[label] = Object.keys(codes).map(key => codes[key].code);

    const updates = {};
    Object.keys(codes).forEach(key => {
      updates[`codes/${label}/${key}/used`] = true;
    });
    await database.ref().update(updates);
  }

  userBalances[chatId] -= cart.total;
  await database.ref(`userBalances/${chatId}`).set(userBalances[chatId]);

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

  let message = '✅ Ваши коды:\n\n' + codesMessage;

  delete userCarts[chatId];
  
  await bot.sendMessage(chatId, message, {
    parse_mode: 'HTML'
  });
  sendMainMessage(chatId, firstName, lastName);
  await bot.deleteMessage(chatId, messageId);

  sendOrderRequest(`✅ Новый заказ кодами #${orderNumber}\n` +
    `Пользователь: ${firstName} ${lastName} (ID: ${chatId})\n` +
    `Коды:\n\n` + codesMessage + 
    `Сумма: ${cart.total}$`);
};

const ordersRef = database.ref('orders');

let awaitingCodesForProduct = {};
const productCodesRef = database.ref('codes');

let awaitingDeposit = {};
let awaitingBybitDeposit = {};
let awaitingReceipt = {};
let awaitingPubgId = {};
let pendingChecks = {};
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
    {text: '🛠 Товары', callback_data: 'manage-category'},
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
      [{text: '🛒Каталог', callback_data: 'open-shop'}],
      [
          {text: '📦Мои заказы', callback_data: 'my-orders'}, 
          {text: '👤Мой профиль', callback_data: 'my-profile'}
      ],
      [
          {text: '🔗Наш канал', url: 'https://t.me/POSTAVKABOJLHOGO'}, 
          {text: '⚙️Тех.поддержка', url: 'https://t.me/BoJlHoy'}
      ],
      [
        { text: '📖Отзывы', url: 'https://t.me/Bolnojot' }
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

  try {
    if (!userBalances[chatId]) {
      userBalances[chatId] = 0;
      
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

const getUserTag = (msg) => {
  const username = msg.from.username ? `@${msg.from.username}` : `${msg.from.first_name || 'Пользователь'}`;
  return username;
};

bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userTag = getUserTag(msg);
    const cbrData = await getCbrUsdRate();
    const usdRate = cbrData.usdRate

    const replyToMessage = msg.reply_to_message;
  
    if (isAdmin(chatId) && replyToMessage) {
      const userId = replyToMessage.forward_from.id;
  
      bot.sendMessage(userId, `Ответ от администратора: ${msg.text}`).then(() => {
        sendMessageToAllAdmins(`Ответ от ${userTag} пользователю с ID ${userId} был отправлен.`)
      });
    }

    if (msg.chat.id == DEPOSIT_GROUP_ID && msg.from?.id == CRYPTOBOT_ID) {
      const messageText = msg.text;
      const lines = messageText.split(' ');

      const senderIndex = lines.findIndex(line => line === 'отправил(а)');
      
      if (senderIndex === -1 || 
          senderIndex + 2 >= lines.length || 
          lines[senderIndex + 1] !== '🪙') {
          return bot.sendMessage(DEPOSIT_GROUP_ID, '❌ Ошибка парсинга данных перевода');
      }
  
      const paymentData = {
          username: lines.slice(0, senderIndex).join(' ').trim(),
          amount: parseFloat(lines[senderIndex + 2].replace(',', '.')),
          currency: 'USDT'
      };
  
      if (!paymentData.username || isNaN(paymentData.amount)) {
          return bot.sendMessage(DEPOSIT_GROUP_ID, '❌ Ошибка парсинга данных перевода');
      }
  
      const depositsSnapshot = await database.ref('cryptobotDeposits').once('value');
      const deposits = depositsSnapshot.val() || {};
  
      const [userId, deposit] = Object.entries(deposits).find(([, deposit]) => 
          deposit.username === paymentData.username
      ) || [];

      const messageId = deposit.messageId
  
      if (userId && messageId && deposit) {
        await database.ref(`cryptobotDeposits/${userId}`).remove();

        const cleanedAmount = safeRound(paymentData.amount);

        userBalances[userId] = (userBalances[userId] || 0) + cleanedAmount;
        await database.ref(`userBalances/${userId}`).set(userBalances[userId]);

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
  
    if (awaitingPubgId[chatId]) {
      const pubgId = text;
  
      const cart = awaitingPubgId[chatId].cart;
      const type = awaitingPubgId[chatId].type;
  
      const orderNumber = Date.now().toString(36).toUpperCase() + chatId.toString().slice(-4);
  
      const itemsDetails = cart.items.reduce((acc, item) => {
          acc[item.label] = (acc[item.label] || 0) + 1;
          return acc;
      }, {});
  
      const itemsText = Object.entries(itemsDetails)
          .map(([label, count]) => {
              const product = getCurrentProducts(type).find(p => p.label === label);
              return `➥ ${label} × ${count} = ${(product.price * count)}$`;
          })
          .join('\n');
  
      userBalances[chatId] -= cart.total;
      await database.ref(`userBalances/${chatId}`).set(userBalances[chatId]);
  
      const orderData = {
        orderId: orderNumber,
        userId: chatId,
        type: type,
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
  
      try {
          ordersRef.child(chatId).child(orderNumber).set(orderData);
      } catch (error) {
          console.error('Ошибка сохранения заказа:', error);
          return bot.sendMessage(chatId, '❌ Ошибка оформления заказа, попробуйте позже');
    }
      
      const orderText = `✅Новый заказ 
  🧾#${orderNumber} 
  Категория: ${type}
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
      
      delete userCarts[chatId];
  
      bot.sendMessage(chatId, '✅ ID успешно отправлен, ожидайте подтверждение администратора', {
        reply_markup: {
          inline_keyboard: [
            [{text: '🔙 В меню', callback_data: 'return'}]
          ]
        }
      });
  
      customersOrders[chatId] = true;
      awaitingPubgId[chatId] = false;
      
      return;
    } else if (awaitingDeposit[chatId]) {
      const amount = parseFloat(text);

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
        amount: rubToUsd(amount, usdRate),
        userTag: userTag,
        userId: chatId
      };
  
      return;
    } else if (awaitingBybitDeposit[chatId]) {
      const amount = parseFloat(text);

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

      bot.sendMessage(chatId, `Совершите перевод на указанную вами сумму ⤵️
<code>${paymentDetails.ByBit}</code>
Сумма: ${amount}$ (${amount*usdRate}₽)

В ОТВЕТНОМ СООБЩЕНИИ ПРИШЛИТЕ ЧЕК ТРАНЗАКЦИИ`, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{text: '❌ Отмена', callback_data: 'my-profile'}]
            ]
          }
        }
      )
  
      awaitingBybitDeposit[chatId] = false;
      awaitingReceipt[chatId] = {
        amount: amount,
        userTag: userTag,
        userId: chatId
      };
  
      return;
    } else if (awaitingReceipt[chatId]) {
      bot.forwardMessage(DEPOSIT_GROUP_ID, chatId, msg.message_id);
      pendingChecks[chatId] = {
        amount: awaitingReceipt[chatId].amount,
        userTag: awaitingReceipt[chatId].userTag,
        userId: chatId,
      }
  
      database.ref('pendingChecks').set(pendingChecks);
      bot.sendMessage(chatId, 'Чек получен и отправлен администратору на проверку. Ожидайте подтверждения.');
  
      sendMainMessage(chatId, msg.chat.first_name, msg.chat.last_name);
      
      const userInfo = pendingChecks[chatId];
      sendDepositRequest(
        `🆕 Запрос на пополнение баланса\n` +
        `👤 Пользователь: ${userTag} (ID: ${chatId})\n` +
        `💵 Сумма: ${userInfo.amount}$ (${userInfo.amount * usdRate}₽)\n` +
        `📅 Время: ${new Date().toLocaleString()}`,
        [
          [
            { text: '✅ Подтвердить', callback_data: `confirm_${chatId}` },
            { text: '❌ Отклонить', callback_data: `reject_${chatId}` }
          ]
        ]
      );
  
      awaitingReceipt[chatId] = false;
  
      return;
    } else if (awaitingToChangeProduct[chatId]) {
      const type = awaitingToChangeProduct[chatId].type;
      const currentProducts = getCurrentProducts(type);
      const product = awaitingToChangeProduct[chatId].product;

      const newPrice = parseFloat(msg.text);
      if (isNaN(newPrice)) {
          bot.sendMessage(chatId, 'Пожалуйста, введите корректную цену.');
          return;
      }
  
      product.price = newPrice;

      database.ref(`products${capitalizeFirstLetter(type)}`).set(currentProducts)
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
      const type = awaitingNewProductLabel[chatId].type;

      bot.sendMessage(chatId, `Введите цену для нового товара (${newLabel}): `);
  
      awaitingNewProductLabel[chatId] = false;
      awaitingNewProductPrice[chatId] = {type, newLabel};
      
      return;
    } else if (awaitingNewProductPrice[chatId]) {
      const type = awaitingNewProductPrice[chatId].type;
      const newLabel = awaitingNewProductPrice[chatId].newLabel
      const newPrice = parseFloat(msg.text);
      if (isNaN(newPrice)) {
        bot.sendMessage(chatId, 'Пожалуйста, введите корректную цену');
        return;
      }

      const currentProducts = getCurrentProducts(type);
      currentProducts.push({label: newLabel, price: newPrice});
      currentProducts.sort((a, b) => {
        return parseInt(a.label, 10) - parseInt(b.label, 10);
      });

      updateProducts(type, currentProducts).then(() => {
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
      const userId = msg.text;
      
      bot.sendMessage(chatId, `Баланс пользователя ${userBalances[userId]}. Введите новую сумму для баланса:`);
  
      awaitingToChangeBalance[chatId] = {userId}
      awaitingUserToChangeBalance[chatId] = false
      
      return;
    } else if (awaitingToChangeBalance[chatId]) {
      const newBalance = parseFloat(msg.text);
      const userId = awaitingToChangeBalance[chatId].userId
  
      if (isNaN(newBalance)) {
        bot.sendMessage(chatId, 'Пожалуйста, введите корректную сумму.');
        return;
      }
  
      if (userBalances[userId] || userBalances[userId] === 0) {
        userBalances[userId] = newBalance;
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
  
          const userIds = Object.keys(userBalances);
          for (const userId of userIds) {
            try {
              await bot.sendMessage(userId, broadcastMessage);
            } catch (error) {
              if (error.response && error.response.statusCode === 429) {
                const retryAfter = error.response.body.parameters.retry_after || 1;
                console.log(`Превышен лимит запросов, повтор через ${retryAfter} секунд...`);
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
              }
            }
        
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
            
      if (admins[adminIdToRemove]) {
        if (adminIdToRemove === ADMIN_CHAT_ID) {
          bot.sendMessage(chatId, 'Нельзя удалить главного администратора');
        } else {
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

bot.on('callback_query', async (query) => {
  try {

    const chatId = query.message.chat.id;
    const data = query.data;
    const messageId = query.message.message_id
    const cbrData = await getCbrUsdRate()
    const usdRate = cbrData.usdRate
  
    if (userBalances[chatId] === undefined) {
      userBalances[chatId] = 0;
    }
  
    if (data === 'return') {
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
  
      sendMainMessage(chatId, query.message.chat.first_name, query.message.chat.last_name, messageId);
      
      return;
    } else if (data === 'open-shop') {
      await bot.editMessageCaption('Выберите тип товара', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{text: 'UC', callback_data: 'open-catalog_uc'}],
            [{text: 'Популярность', callback_data: 'open-catalog_popularity'}],
            [{text: 'Подписки', callback_data: 'open-catalog_subs'}],
            [{text: '🔙 Назад', callback_data: 'return'}]
          ]
        }
      })
    } else if (data.startsWith('open-catalog_')) {
      const productType = data.split('_')[1];

      delete userCarts[chatId];

      if (productType === 'uc') {
        await bot.editMessageCaption('Выберите каким способом вы хотите получить UC', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {inline_keyboard: [
            [{text: 'Получить кодами', callback_data: 'open-catalog_codes'}],
            [{text: 'Получить по id', callback_data: 'open-catalog_id'}],
            [{text: '🔙 Назад', callback_data: 'open-shop'}]
          ]}
        })
      } else {
        const inlineKeyboard = await generateShopKeyboard(userCarts[chatId], productType);
        await bot.editMessageMedia({
          type: 'photo',
          media: IMAGES.pack,
          caption: generateCartText(userCarts[chatId], productType),
          parse_mode: 'HTML'
        }, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: inlineKeyboard
          }
        });
        }

        return;
    } else if (data === 'admin-panel') {
      if (!isAdmin(chatId)) {
        await bot.answerCallbackQuery(query.id, {text: '❌ Доступ запрещен!'});
        return;
      }
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
  
    } else if (data === 'manage-category') {
      await bot.editMessageCaption('🛠 Выберите категорию товаров для изменения', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{text: 'Коды', callback_data: 'manage-products_codes'}],
            [{text: 'По ID', callback_data: 'manage-products_id'}],
            [{text: 'Популярность', callback_data: 'manage-products_popularity'}],
            [{text: 'Подписки', callback_data: 'manage-products_subs'}],
            [{text: '🔙 Назад', callback_data: 'admin-panel'}]
          ]
        }
      })
    } else if (data.startsWith('manage-products_')) {
      const type = data.split('_')[1];
      const currentProducts = getCurrentProducts(type);

      const productsManagementKeyboard = (currentProducts) => {
        const buttons = currentProducts.map(p => ({
          text: `${p.label} - ${p.price}$`,
          callback_data: `edit-product_${type}_${p.label}`
        }));
        
        const chunks = [];
        while (buttons.length) chunks.push(buttons.splice(0, 2));
        
        chunks.push(
          [{text: '➕ Добавить товар', callback_data: `add-product_${type}`}, {text: '➖ Удалить товар', callback_data: `delete-product-list_${type}`}],
          [{text: '🔙 Назад', callback_data: 'admin-panel'}]
        );
        
        return chunks;
      };

      await bot.editMessageCaption(`🛠 Управление товарами (Категория: ${type}):`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {inline_keyboard: productsManagementKeyboard(currentProducts)}
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
            ], [
              { text: 'CryptoBot', callback_data: 'select-payment-method_CryptoBot' }
            ],  [
              { text: 'Карта', callback_data: 'select-payment-method_card' }
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
    } else if (data.startsWith('add-product_')) {
      const type = data.split('_')[1];
      awaitingNewProductLabel[chatId] = {type};

      await bot.editMessageCaption('Введите название нового товара:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'admin-panel'}]]}
      })
  
      return;
    } else if (data.startsWith('delete-product-list_')) {
      const type = data.split('_')[1];

      const productButtons = getCurrentProducts(type).map(product => ({
        text: `${product.label} - ${product.price}$`,
        callback_data: `delete-product_${type}_${product.label}`
      }));
  
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
  
        userBalances[userId] = (userBalances[userId] || 0) + depositAmount;
  
        database.ref('userBalances').set(userBalances);
  
        sendDepositRequest(`Пополнение на ${depositAmount}$ для ${userInfo.userTag} (ID: ${userId}) подтверждено.`)
        bot.sendMessage(userId, `Ваш баланс был пополнен на ${depositAmount}$. Текущий баланс: ${userBalances[userId]}$.`);
  
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
            await purchaseWithId(chatId, messageId, type);
            break;
            
          case 'buy-codes':
            await purchaseCodes(chatId, messageId, query.message.chat.first_name, query.message.chat.last_name)
            break;
        }
        return;
    } else if (data.startsWith('add-to-cart_')) {
      const [, label, price, type] = data.split('_');
      const currentProducts = getCurrentProducts(type);
      const product = currentProducts.find(p => p.label === label);
      
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
        sendDepositRequest(`Пополнение на ${userInfo.amount}$ для ${userInfo.userTag} (ID: ${userId}) отменено.`)
        bot.sendMessage(userId, `Ваше пополнение на сумму ${userInfo.amount}$ было отклонено. Пожалуйста, попробуйте снова.`);
  
        delete pendingChecks[userId];
        database.ref('pendingChecks').set(pendingChecks);
      }
      
      return;
    } else if (data.startsWith('order-completed_')) {
      const [, userId, orderId] = query.data.split('_');
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
            sendOrderRequest(`Заказ для пользователя с ID ${userId} был выполнен.`)
        
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
      const [, userId, orderId, amount] = query.data.split('_');
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
            userBalances[userId] += Math.round(parseFloat(amount) * 100) / 100;

            sendOrderRequest(`❌ Заказ для пользователя с ID ${userId} был отменен.`)
        
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
      const [, type, label] = data.split('_');
  
      if (!isAdmin(query.from.id)) {
        return
      }
  
      const currentProducts = getCurrentProducts(type);
      const product = currentProducts.find(p => p.label === label);

      if (!product) {
          bot.sendMessage(chatId, `Товар с меткой ${label} не найден.`);
          return;
      }
  
      bot.sendMessage(chatId, `Введите новую цену для товара ${label} UC:`);
  
      awaitingToChangeProduct[chatId] = {type, product}
  
      return;
    } else if (data.startsWith('delete-product_')) {
      const [, type, labelToDelete] = data.split('_');
  
      if (!isAdmin(query.from.id)) {
        return
      }

      const currentProducts = getCurrentProducts(type);
  
      const product = currentProducts.find(p => p.label === labelToDelete);
      if (!product) {
          bot.sendMessage(chatId, `Товар с меткой ${labelToDelete} не найден.`);
          return;
      }
  
      const index = currentProducts.findIndex(product => product.label === labelToDelete);
  
      if (index !== -1) {
        currentProducts.splice(index, 1);
        updateProducts(type, currentProducts)
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
      const productsKeyboard = productsCodes.map(p => ({
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
    
      try {
        const unusedCodesSnapshot = await database.ref(`codes/${productLabel}`)
          .orderByChild('used')
          .equalTo(false)
          .once('value');
    
        const unusedCodes = unusedCodesSnapshot.val() || {};
    
        let unusedCodesMessage = `📋 Текущие неиспользованные коды для ${productLabel} UC:\n`;
    
        Object.values(unusedCodes).forEach((codeData, index) => {
          unusedCodesMessage += `${index + 1}. <code>${codeData.code}</code>\n`;
        });
    
        await bot.sendMessage(chatId, unusedCodesMessage, {
          parse_mode: 'HTML'
        });
    
      } catch (error) {
        console.error('Ошибка получения кодов:', error);
        await bot.sendMessage(chatId, '❌ Ошибка при получении неиспользованных кодов');
      }
    
      await bot.editMessageCaption(`Отправьте коды для ${productLabel} UC (по одному в строке):`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'manage-codes' }]] }
      })

    } else if (data === 'deposit') {
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
            [{text: '💳Перевод по карте', callback_data: 'deposit-with-card'}],
            [{text: '🔸ByBit', callback_data: 'deposit-with-bybit'}],
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
  
      awaitingDeposit[chatId] = true;
      
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
  
      const firstName = query.message.chat.first_name || '';
      const lastName = query.message.chat.last_name || '';
      const fullName = `${firstName}${lastName ? ' ' + lastName : ''}`.trim();
  
      cryptobotDeposits[chatId] = {
          userId: chatId,
          messageId: messageId,
          username: fullName
      };
  
      database.ref('cryptobotDeposits').set(cryptobotDeposits);
    
        return;
    } else if (data === 'deposit-with-bybit') {
      await bot.editMessageMedia({
        type: 'photo',
        media: IMAGES.amount,
        caption: 'Отправьте сумму, на которую хотите пополнить баланс (в $): '
      }, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{text: '❌ Отмена', callback_data: 'my-profile'}]
          ]
        }
      })

      awaitingBybitDeposit[chatId] = true;

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
