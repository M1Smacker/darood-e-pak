// Every word on screen, English and Urdu. The Urdu is mine and needs a family proofread (spec §6).
// {x} placeholders are filled by t(). Numbers are passed in already formatted.

const en = {
  app: 'Darood-e-Pak',
  tab_home: 'Home', tab_board: 'Leaderboard', tab_ammi: 'Ammi Jaan', tab_me: 'Me',
  loading: 'Loading…',
  offline_first: 'The app needs internet the first time it opens. Please connect and try again.',
  not_setup: 'The app is not connected to its database yet.',
  load_error: 'Could not reach the database. Check your internet and open the app again.',
  syncing: 'Waiting to sync', offline: 'Offline, saved on this phone',
  // sign-in
  search: 'Find your name, or type it to join', im_new: "I'm new", cancel: 'Cancel', back: 'Back',
  join_as: 'Join as {name}', type_name_first: 'Type your full name in the box above, then tap here.',
  is_this_you: 'Are you {name}?', yes_me: 'Yes, this is me',
  name_taken: '{name} is already here. Is that you?',
  name_short: 'Please type your full name.', name_long: 'That name is too long (40 letters at most).', name_letters: 'A name needs letters.',
  no_match: 'No one with that name yet.', first_one: 'No one has joined yet. Type your full name above to be the first.',
  // home
  salaam: 'Assalamu alaikum, {name}',
  this_week: 'This week', of_count: 'of {count}', not_ranked: 'Not on the board yet this week',
  today: 'Today', yesterday: 'Yesterday', streak: 'Streak', days: '{n} days', day1: '1 day',
  goal_of: 'of {goal}', ammi_short: "Ammi Jaan's 1 Crore",
  add_title: 'Add Darood', add_ammi_title: 'Add for Ammi Jaan', how_many: 'How many?', add: 'Add',
  day_label: 'Day', for_label: 'Entering for', me_word: 'Me',
  tap_counter: 'Tap counter', today_entries: "Today's entries", undo: 'Undo',
  saved: 'Saved {n}', saved_for: 'Saved {n} for {name}',
  sure_big: 'Are you sure? {n} Darood in one entry.', yes_save: 'Yes, save', no_fix: 'No, let me fix it',
  err_empty: 'Type how many you read.', err_invalid: 'Only whole numbers, like 500.', err_zero: 'The number must be more than 0.',
  err_max: 'One entry can be at most {max}. Add the rest as another entry.', err_day: 'You can only add up to 7 days back.',
  err_save: "Couldn't save. Please try again.", err_denied: 'The database refused this change.',
  ammi_closed: "Ammi Jaan's goal is complete. Nothing more can be added.",
  // counter
  counter_title: 'Tap counter', counter_ammi: 'For Ammi Jaan', tap_hint: 'Tap anywhere to count',
  target: 'Target', none: 'None', custom: 'Custom', minus1: '−1', save: 'Save', close: 'Close',
  target_reached: 'Target reached', save_to: 'Save {n} to which day?', started_on: 'You started counting on {day}.',
  save_nothing: 'Nothing counted yet.', reset: 'Start over', reset_sure: 'Clear this count of {n}?',
  // board
  week: 'Week', month: 'Month', all_time: 'All time', you: 'You', empty_board: 'No one has read yet in this period.',
  past_winners: 'Past winners', no_winners: 'No finished weeks or months yet.',
  before_incl: 'All time includes totals from before the app.',
  // ammi
  read_by_her: 'Read by Ammi Jaan herself', start_unset: 'Her starting number will be added by the admin.',
  total_so_far: 'Total so far', remaining: 'Remaining', complete: 'Completed on {day}',
  complete_short: 'Completed', reached_on: '{n} reached on {day}',
  feed_today: 'Read for her today', feed_empty: 'Nothing yet today.', week_total: 'This week', month_total: 'This month',
  family_cal: 'Family calendar', my_share: 'My share (only you see this)',
  // me
  all_time_total: 'All time', best_day: 'Best day', best_week: 'Best week', daily_goal: 'Daily goal',
  set_goal: 'Set a daily goal', goal_none: 'No goal set', milestones: 'Milestones', passed_on: 'Passed {n} on {day}',
  before_app: 'Read before the app', before_app_sub: 'Your total from before you joined. Counts in All time only.',
  settings: 'Settings', text_size: 'Text size', darood_choice: 'Darood on the counter', not_you: 'Not you?',
  not_you_sure: 'Switch to a different name on this phone?', switch: 'Switch',
  install: 'Add to Home Screen', install_ios: 'iPhone: open in Safari, tap Share, then "Add to Home Screen".',
  install_android: 'Android: open in Chrome, tap ⋮, then "Install app" or "Add to Home screen".',
  day_detail: '{day}', edit: 'Edit', delete: 'Delete', delete_sure: 'Delete this entry of {n}?',
  edit_title: 'Change the number', locked_old: 'Older than 7 days: ask the admin to change it.',
  deleted_word: 'deleted', edited_word: 'edited', save_changes: 'Save',
  admin: 'Admin', version: 'Version {v}',
  // months / days
  months: 'January February March April May June July August September October November December',
  wd: 'Mon Tue Wed Thu Fri Sat Sun',
  week_range: '{a} to {b}',
};

const ur = {
  app: 'درود پاک',
  tab_home: 'ہوم', tab_board: 'لیڈر بورڈ', tab_ammi: 'امی جان', tab_me: 'میں',
  loading: 'لوڈ ہو رہا ہے…',
  offline_first: 'پہلی بار ایپ کھولنے کے لیے انٹرنیٹ ضروری ہے۔ براہِ کرم انٹرنیٹ سے جڑ کر دوبارہ کوشش کریں۔',
  not_setup: 'ایپ ابھی ڈیٹا بیس سے نہیں جڑی۔',
  load_error: 'ڈیٹا بیس تک رسائی نہیں ہو سکی۔ انٹرنیٹ چیک کر کے ایپ دوبارہ کھولیں۔',
  syncing: 'محفوظ ہونے کا انتظار', offline: 'آف لائن، اس فون پر محفوظ',
  search: 'اپنا نام تلاش کریں، یا شامل ہونے کے لیے لکھیں', im_new: 'میں نیا ہوں', cancel: 'منسوخ', back: 'واپس',
  join_as: '{name} کے نام سے شامل ہوں', type_name_first: 'اوپر والے خانے میں اپنا پورا نام لکھیں، پھر یہاں دبائیں۔',
  is_this_you: 'کیا آپ {name} ہیں؟', yes_me: 'جی ہاں، یہ میں ہوں',
  name_taken: '{name} پہلے سے موجود ہے۔ کیا یہ آپ ہیں؟',
  name_short: 'براہِ کرم اپنا پورا نام لکھیں۔', name_long: 'نام بہت لمبا ہے (زیادہ سے زیادہ 40 حروف)۔', name_letters: 'نام میں حروف ہونے چاہییں۔',
  no_match: 'اس نام کا کوئی ابھی موجود نہیں۔', first_one: 'ابھی کوئی شامل نہیں ہوا۔ سب سے پہلے اوپر اپنا پورا نام لکھیں۔',
  salaam: 'السلام علیکم، {name}',
  this_week: 'اس ہفتے', of_count: '{count} میں سے', not_ranked: 'اس ہفتے ابھی بورڈ پر نہیں',
  today: 'آج', yesterday: 'کل', streak: 'مسلسل دن', days: '{n} دن', day1: '1 دن',
  goal_of: '{goal} میں سے', ammi_short: 'امی جان کا ایک کروڑ',
  add_title: 'درود شامل کریں', add_ammi_title: 'امی جان کے لیے شامل کریں', how_many: 'کتنے؟', add: 'شامل کریں',
  day_label: 'دن', for_label: 'کس کی طرف سے', me_word: 'میں',
  tap_counter: 'تسبیح کاؤنٹر', today_entries: 'آج کے اندراج', undo: 'واپس لیں',
  saved: '{n} محفوظ ہو گئے', saved_for: '{name} کے لیے {n} محفوظ ہو گئے',
  sure_big: 'کیا آپ کو یقین ہے؟ ایک اندراج میں {n} درود۔', yes_save: 'جی ہاں، محفوظ کریں', no_fix: 'نہیں، درست کرتا ہوں',
  err_empty: 'لکھیں کہ آپ نے کتنے پڑھے۔', err_invalid: 'صرف پورے عدد، جیسے 500۔', err_zero: 'عدد 0 سے زیادہ ہونا چاہیے۔',
  err_max: 'ایک اندراج زیادہ سے زیادہ {max} کا ہو سکتا ہے۔ باقی الگ اندراج میں شامل کریں۔', err_day: 'صرف پچھلے 7 دن تک شامل کیا جا سکتا ہے۔',
  err_save: 'محفوظ نہیں ہو سکا۔ دوبارہ کوشش کریں۔', err_denied: 'ڈیٹا بیس نے یہ تبدیلی قبول نہیں کی۔',
  ammi_closed: 'امی جان کا ہدف مکمل ہو چکا ہے۔ اب مزید شامل نہیں کیا جا سکتا۔',
  counter_title: 'تسبیح کاؤنٹر', counter_ammi: 'امی جان کے لیے', tap_hint: 'گننے کے لیے کہیں بھی ٹیپ کریں',
  target: 'ہدف', none: 'کوئی نہیں', custom: 'اپنا', minus1: '−1', save: 'محفوظ کریں', close: 'بند کریں',
  target_reached: 'ہدف پورا ہو گیا', save_to: '{n} کس دن میں محفوظ کریں؟', started_on: 'آپ نے {day} کو گننا شروع کیا تھا۔',
  save_nothing: 'ابھی کچھ نہیں گنا۔', reset: 'دوبارہ شروع کریں', reset_sure: '{n} کی یہ گنتی صاف کر دیں؟',
  week: 'ہفتہ', month: 'مہینہ', all_time: 'اب تک', you: 'آپ', empty_board: 'اس عرصے میں ابھی کسی نے نہیں پڑھا۔',
  past_winners: 'پچھلے فاتحین', no_winners: 'ابھی کوئی ہفتہ یا مہینہ مکمل نہیں ہوا۔',
  before_incl: '"اب تک" میں ایپ سے پہلے کے درود بھی شامل ہیں۔',
  read_by_her: 'امی جان نے خود پڑھے', start_unset: 'ان کا ابتدائی عدد ایڈمن شامل کریں گے۔',
  total_so_far: 'اب تک کل', remaining: 'باقی', complete: '{day} کو مکمل ہوا',
  complete_short: 'مکمل', reached_on: '{day} کو {n} مکمل ہوئے',
  feed_today: 'آج ان کے لیے پڑھے گئے', feed_empty: 'آج ابھی کچھ نہیں۔', week_total: 'اس ہفتے', month_total: 'اس مہینے',
  family_cal: 'خاندان کا کیلنڈر', my_share: 'میرا حصہ (صرف آپ دیکھ سکتے ہیں)',
  all_time_total: 'اب تک', best_day: 'بہترین دن', best_week: 'بہترین ہفتہ', daily_goal: 'روزانہ ہدف',
  set_goal: 'روزانہ ہدف مقرر کریں', goal_none: 'کوئی ہدف نہیں', milestones: 'سنگِ میل', passed_on: '{day} کو {n} مکمل کیے',
  before_app: 'ایپ سے پہلے پڑھے', before_app_sub: 'شامل ہونے سے پہلے کا آپ کا کل۔ صرف "اب تک" میں گنا جاتا ہے۔',
  settings: 'ترتیبات', text_size: 'حروف کا سائز', darood_choice: 'کاؤنٹر پر درود', not_you: 'آپ نہیں؟',
  not_you_sure: 'اس فون پر کوئی اور نام منتخب کریں؟', switch: 'بدلیں',
  install: 'ہوم اسکرین پر شامل کریں', install_ios: 'آئی فون: سفاری میں کھولیں، شیئر دبائیں، پھر "Add to Home Screen"۔',
  install_android: 'اینڈرائیڈ: کروم میں کھولیں، ⋮ دبائیں، پھر "Install app" یا "Add to Home screen"۔',
  day_detail: '{day}', edit: 'تبدیل کریں', delete: 'حذف کریں', delete_sure: '{n} کا یہ اندراج حذف کریں؟',
  edit_title: 'عدد تبدیل کریں', locked_old: '7 دن سے پرانا: تبدیلی کے لیے ایڈمن سے کہیں۔',
  deleted_word: 'حذف شدہ', edited_word: 'تبدیل شدہ', save_changes: 'محفوظ کریں',
  admin: 'ایڈمن', version: 'ورژن {v}',
  months: 'جنوری فروری مارچ اپریل مئی جون جولائی اگست ستمبر اکتوبر نومبر دسمبر',
  wd: 'پیر منگل بدھ جمعرات جمعہ ہفتہ اتوار',
  week_range: '{a} تا {b}',
};

export const LANGS = { en, ur };
let lang = 'en';
export const setLang = (l) => { lang = LANGS[l] ? l : 'en'; };
export const getLang = () => lang;

export function t(key, vars = {}) {
  const s = LANGS[lang][key] ?? en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

export const monthName = (m) => t('months').split(' ')[m - 1];
export const weekdays = () => t('wd').split(' ');
// "19 November", "19 November 2026" when another year.
export function dateText(key, withYear = false) {
  const [y, m, d] = key.split('-').map(Number);
  return `${d} ${monthName(m)}${withYear ? ` ${y}` : ''}`;
}
