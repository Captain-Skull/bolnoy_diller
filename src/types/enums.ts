export enum UserState {
  DEFAULT = 'default',

  AWAITING_ID = 'awaiting_id',

  AWAITING_DEPOSIT_CARD = 'awaiting_deposit_card',
  AWAITING_DEPOSIT_BYBIT = 'awaiting_deposit_bybit',
  AWAITING_RECEIPT = 'awaiting_receipt',

  AWAITING_PRODUCT_PRICE = 'awaiting_product_price',
  AWAITING_NEW_PRODUCT_LABEL = 'awaiting_new_product_label',
  AWAITING_NEW_PRODUCT_PRICE = 'awaiting_new_product_price',

  AWAITING_CREDENTIALS = 'awaiting_credentials',

  AWAITING_USER_FOR_BALANCE = 'awaiting_user_for_balance',
  AWAITING_NEW_BALANCE = 'awaiting_new_balance',

  AWAITING_BROADCAST = 'awaiting_broadcast',

  AWAITING_ADD_ADMIN = 'awaiting_add_admin',
  AWAITING_REMOVE_ADMIN = 'awaiting_remove_admin',

  AWAITING_CODES = 'awaiting_codes',
}

export enum ProductCategory {
  CODES = 'codes',
  ID = 'id',
  POPULARITY = 'popularity',
  SUBS = 'subs',
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  DECLINED = 'declined',
}
