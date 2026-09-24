// English is the source dictionary: ar.ts must provide every key (enforced by its type).
export const en = {
  'brand.name': 'ATC',
  'brand.full': 'Amman Tutoring Center',
  'brand.tagline': 'Learning & Assessment',

  'lang.switch': 'العربية',
  'lang.switchLabel': 'Switch language to Arabic',

  'common.loading': 'Loading…',
  'common.retry': 'Try again',
  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.viewAll': 'View all',
  'common.minutes': '{n} minutes',
  'common.questions': '{n} questions',
  'common.points': '{n} pts',
  'common.error': 'Something went wrong. Please try again.',
  'common.offline': 'Could not reach the server. Check your connection.',

  'nav.main': 'Main navigation',
  'nav.home': 'Home',
  'nav.myQuizzes': 'My Quizzes',
  'nav.results': 'Results',
  'nav.quizzes': 'My Quizzes',
  'nav.allQuizzes': 'All Quizzes',
  'nav.newQuiz': 'New Quiz',

  'role.STUDENT': 'Student',
  'role.TEACHER': 'Teacher',
  'role.ADMIN': 'Admin',

  'auth.heroTitle': 'Keep learning,',
  'auth.heroAccent': 'keep growing.',
  'auth.heroBody': 'Take your weekly quizzes, see your score straight away, and track your progress with ATC.',
  'auth.title': 'Welcome back',
  'auth.subtitle': 'Sign in with the username your centre gave you.',
  'auth.username': 'Username',
  'auth.password': 'Password',
  'auth.showPassword': 'Show password',
  'auth.hidePassword': 'Hide password',
  'auth.submit': 'Sign in',
  'auth.submitting': 'Signing in…',
  'auth.invalid': 'The username or password is incorrect.',
  'auth.tooMany': 'Too many attempts. Please wait a minute and try again.',
  'auth.logout': 'Sign out',

  'notFound.title': 'Page not found',
  'notFound.body': 'The page you are looking for does not exist or is not available to you.',
  'notFound.home': 'Go to home',
} as const

export type MessageKey = keyof typeof en
