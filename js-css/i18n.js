// ============================================================
//  i18n.js — HedgeCapitalPro Internationalization Engine
//  Phase 9 — Translation System
//
//  Features:
//  - Auto-detect language from browser
//  - Manual language switcher
//  - localStorage persistence
//  - RTL support (Arabic)
//  - data-i18n DOM attribute translation
//  - data-i18n-placeholder for input placeholders
//  - data-i18n-aria for aria-label attributes
//  - Fallback chain: selected → English → key itself
//  - Usable on every page via import
//
//  Usage:
//    import { initI18n, t, setLang } from './i18n.js';
//    await initI18n();                        // auto-detect + apply
//    t('nav.services')                        // → "Services"
//    setLang('fr')                            // switch to French
// ============================================================

// ── FULL TRANSLATIONS ─────────────────────────────────────────

export const TRANSLATIONS = {

  // ── ENGLISH ─────────────────────────────────────────────────
  en: {
    // Nav
    'nav.services':  'Services',
    'nav.about':     'About',
    'nav.insights':  'Insights',
    'nav.contact':   'Contact',
    'nav.portal':    'Client Portal',
    'nav.dashboard': 'My Dashboard',

    // Hero
    'hero.eyebrow':  'Financial Consulting & Asset Management',
    'hero.sub':      'Premier financial consulting and asset management services tailored to your goals, risk profile, and long-term vision.',

    // CTAs
    'cta.portal':       'Client Portal →',
    'cta.consultation': 'Schedule a Free Consultation',
    'cta.explore':      'Explore Services',
    'cta.about':        'About Us',
    'cta.submit':       'Submit Request',
    'cta.register':     'Create Account',
    'cta.login':        'Sign In',
    'cta.logout':       'Sign Out',

    // Section labels
    'section.services':  'Services',
    'section.stats':     'By the Numbers',
    'section.about':     'Why Us',
    'section.values':    'Our Values',
    'section.team':      'Our People',
    'section.insights':  'Articles',
    'section.contact':   'Get Started',

    // Section titles
    'services.title':    'Tailored to meet your needs',
    'values.title':      'Guided by integrity, trust, and client-centricity',
    'team.title':        'The people behind your wealth',
    'insights.title':    'Valuable insights that empower your decisions',

    // Stats
    'stats.years':       'Years of Experience',
    'stats.clients':     'Clients Served',
    'stats.aum':         'Assets Under Management',
    'stats.specialists': 'Specialists',

    // Contact
    'contact.headline':  'Schedule your personalized consultation.',
    'contact.sub':       'Drop your details and one of our senior consultants will reach out within one business day.',
    'contact.phone.lbl': 'Mon – Fri, 8am – 7pm EST',
    'contact.email.lbl': 'We reply within 24 hours',
    'contact.addr.lbl':  'Our main office',

    // Form labels
    'form.firstname':    'First Name',
    'form.lastname':     'Last Name',
    'form.email':        'Email Address',
    'form.phone':        'Phone Number',
    'form.company':      'Company Name',
    'form.website':      'Website',
    'form.interest':     'Interested In',
    'form.message':      'Message',
    'form.country':      'Country',
    'form.username':     'Username',
    'form.password':     'Password',
    'form.confirm':      'Confirm Password',
    'form.referral':     'Referral Code',

    // Form placeholders
    'ph.firstname':      'John',
    'ph.lastname':       'Smith',
    'ph.email':          'john@example.com',
    'ph.phone':          '555 000 0000',
    'ph.message':        'Tell us about your financial goals…',
    'ph.password':       'Min. 8 characters',
    'ph.username':       'johnsmith',

    // Auth pages
    'auth.login.title':  'Sign in to your investment portal',
    'auth.login.btn':    'Sign In →',
    'auth.login.forgot': 'Forgot password?',
    'auth.login.noact':  'Don\'t have an account?',
    'auth.login.create': 'Create one free',
    'auth.login.remember':'Remember me',

    'auth.register.title': 'Create your investment account — it\'s free',
    'auth.register.btn':   'Create Account →',
    'auth.register.terms': 'I agree to the Privacy Policy and Terms & Conditions of HedgeCapitalPro',
    'auth.register.have':  'Already have an account?',
    'auth.register.signin':'Sign in',

    'auth.forgot.title':  'Forgot Password?',
    'auth.forgot.sub':    'Enter your account email and we\'ll send you a secure reset link.',
    'auth.forgot.btn':    'Send Reset Link →',
    'auth.forgot.back':   'Remember it? Sign in',

    'auth.reset.title':   'Set New Password',
    'auth.reset.sub':     'Choose a strong password for your account.',
    'auth.reset.btn':     'Update Password →',

    // Dashboard
    'dash.welcome':      'Welcome back',
    'dash.overview':     'Here\'s your portfolio summary',
    'dash.balance':      'Total Balance',
    'dash.invested':     'Total Invested',
    'dash.profit':       'Total Profit',
    'dash.withdrawn':    'Total Withdrawn',
    'dash.available':    'Available to withdraw',
    'dash.lifetime':     'Lifetime withdrawals',
    'dash.active':       'Active Investments',
    'dash.new.invest':   '+ New Investment',
    'dash.growth':       'Portfolio Growth',
    'dash.no.invest':    'No active investments yet.',

    'dash.invest.title': 'Investment Plans',
    'dash.invest.sub':   'Choose a plan that matches your goals. All returns are credited daily.',
    'dash.invest.now':   'Invest Now',
    'dash.invest.daily': 'Daily ROI · Continuous earnings',

    'dash.deposit.title': 'Deposit Funds',
    'dash.deposit.sub':   'Send crypto to your dedicated wallet address to fund your account',
    'dash.deposit.step1': 'Step 1',
    'dash.deposit.s1':    'Select Cryptocurrency',
    'dash.deposit.step2': 'Step 2',
    'dash.deposit.s2':    'Send to Wallet Address',
    'dash.deposit.step3': 'Step 3',
    'dash.deposit.s3':    'Enter Amount & Upload Proof',
    'dash.deposit.copy':  '📋 Copy Address',
    'dash.deposit.submit':'Submit Deposit Request →',
    'dash.deposit.min':   'Minimum deposit is $100',

    'dash.withdraw.title':'Withdraw Funds',
    'dash.withdraw.sub':  'Withdrawals are processed within 24–48 business hours',
    'dash.withdraw.btn':  'Request Withdrawal →',
    'dash.withdraw.min':  'Minimum withdrawal: $50',

    'dash.tx.title':     'Transaction History',
    'dash.tx.sub':       'All your deposits, withdrawals, and profit credits',
    'dash.tx.none':      'No transactions yet.',

    'dash.ref.title':    'Referral Program',
    'dash.ref.sub':      'Earn 5% commission on every deposit made by people you refer',
    'dash.ref.code':     'Your Referral Code',
    'dash.ref.copy':     '📋 Copy Code',
    'dash.ref.link':     'Copy Link',
    'dash.ref.total':    'Total Referrals',
    'dash.ref.earned':   'Commission Earned',
    'dash.ref.rate':     'Commission Rate',

    'dash.profile.title':'My Profile',
    'dash.profile.sub':  'Manage your account details',
    'dash.profile.save': 'Save Changes',
    'dash.profile.pass': 'Change Password',
    'dash.profile.update':'Update Password',

    // Footer
    'footer.privacy':    'Privacy Policy',
    'footer.terms':      'Terms of Use',
    'footer.portal':     'Client Portal',
  },

  // ── FRENCH ──────────────────────────────────────────────────
  fr: {
    'nav.services':  'Services',
    'nav.about':     'À Propos',
    'nav.insights':  'Insights',
    'nav.contact':   'Contact',
    'nav.portal':    'Portail Client',
    'nav.dashboard': 'Mon Tableau de Bord',

    'hero.eyebrow':  'Conseil Financier & Gestion d\'Actifs',
    'hero.sub':      'Services de conseil financier et de gestion d\'actifs de premier ordre, adaptés à vos objectifs et à votre vision à long terme.',

    'cta.portal':       'Portail Client →',
    'cta.consultation': 'Planifier une Consultation Gratuite',
    'cta.explore':      'Explorer les Services',
    'cta.about':        'À Propos',
    'cta.submit':       'Envoyer la Demande',
    'cta.register':     'Créer un Compte',
    'cta.login':        'Se Connecter',
    'cta.logout':       'Se Déconnecter',

    'section.services':  'Services',
    'section.stats':     'En Chiffres',
    'section.about':     'Pourquoi Nous',
    'section.values':    'Nos Valeurs',
    'section.team':      'Notre Équipe',
    'section.insights':  'Articles',
    'section.contact':   'Commencer',

    'services.title':    'Adaptés à vos besoins',
    'values.title':      'Guidés par l\'intégrité, la confiance et la centricité client',
    'team.title':        'Les personnes derrière votre patrimoine',
    'insights.title':    'Des informations précieuses pour renforcer vos décisions',

    'stats.years':       'Années d\'Expérience',
    'stats.clients':     'Clients Servis',
    'stats.aum':         'Actifs Sous Gestion',
    'stats.specialists': 'Spécialistes',

    'contact.headline':  'Planifiez votre consultation personnalisée.',
    'contact.sub':       'Remplissez le formulaire et l\'un de nos consultants senior vous contactera dans un délai d\'un jour ouvrable.',

    'form.firstname':    'Prénom',
    'form.lastname':     'Nom',
    'form.email':        'Adresse Email',
    'form.phone':        'Numéro de Téléphone',
    'form.message':      'Message',
    'form.country':      'Pays',
    'form.username':     'Nom d\'utilisateur',
    'form.password':     'Mot de passe',
    'form.confirm':      'Confirmer le mot de passe',
    'form.referral':     'Code de Parrainage',

    'ph.message':    'Parlez-nous de vos objectifs financiers…',
    'ph.password':   'Min. 8 caractères',
    'ph.email':      'john@exemple.com',

    'auth.login.title':  'Connectez-vous à votre portail d\'investissement',
    'auth.login.btn':    'Se Connecter →',
    'auth.login.forgot': 'Mot de passe oublié?',
    'auth.login.noact':  'Pas encore de compte?',
    'auth.login.create': 'Créez-en un gratuitement',
    'auth.login.remember':'Se souvenir de moi',

    'auth.register.title': 'Créez votre compte d\'investissement — c\'est gratuit',
    'auth.register.btn':   'Créer un Compte →',
    'auth.register.have':  'Vous avez déjà un compte?',
    'auth.register.signin':'Se connecter',

    'auth.forgot.title':  'Mot de passe oublié?',
    'auth.forgot.sub':    'Entrez votre email et nous vous enverrons un lien de réinitialisation sécurisé.',
    'auth.forgot.btn':    'Envoyer le Lien →',
    'auth.forgot.back':   'Vous vous en souvenez? Se connecter',

    'auth.reset.title':   'Définir un Nouveau Mot de Passe',
    'auth.reset.sub':     'Choisissez un mot de passe fort pour votre compte.',
    'auth.reset.btn':     'Mettre à Jour →',

    'dash.welcome':      'Bon retour',
    'dash.overview':     'Voici le résumé de votre portefeuille',
    'dash.balance':      'Solde Total',
    'dash.invested':     'Total Investi',
    'dash.profit':       'Profit Total',
    'dash.withdrawn':    'Total Retiré',
    'dash.available':    'Disponible pour retrait',
    'dash.lifetime':     'Retraits à vie',
    'dash.active':       'Investissements Actifs',
    'dash.new.invest':   '+ Nouvel Investissement',
    'dash.growth':       'Croissance du Portefeuille',

    'dash.invest.title': 'Plans d\'Investissement',
    'dash.invest.now':   'Investir Maintenant',
    'dash.deposit.title':'Déposer des Fonds',
    'dash.deposit.copy': '📋 Copier l\'Adresse',
    'dash.deposit.submit':'Soumettre la Demande →',
    'dash.withdraw.title':'Retirer des Fonds',
    'dash.withdraw.btn': 'Demander un Retrait →',
    'dash.tx.title':     'Historique des Transactions',
    'dash.ref.title':    'Programme de Parrainage',
    'dash.ref.copy':     '📋 Copier le Code',
    'dash.profile.title':'Mon Profil',
    'dash.profile.save': 'Enregistrer les Modifications',

    'footer.privacy':    'Politique de Confidentialité',
    'footer.terms':      'Conditions d\'Utilisation',
    'footer.portal':     'Portail Client',
  },

  // ── SPANISH ──────────────────────────────────────────────────
  es: {
    'nav.services':  'Servicios',
    'nav.about':     'Nosotros',
    'nav.insights':  'Perspectivas',
    'nav.contact':   'Contacto',
    'nav.portal':    'Portal del Cliente',
    'nav.dashboard': 'Mi Panel',

    'hero.eyebrow':  'Consultoría Financiera & Gestión de Activos',
    'hero.sub':      'Servicios de consultoría financiera y gestión de activos de primer nivel adaptados a sus objetivos y visión a largo plazo.',

    'cta.portal':       'Portal del Cliente →',
    'cta.consultation': 'Agendar Consulta Gratuita',
    'cta.explore':      'Explorar Servicios',
    'cta.about':        'Sobre Nosotros',
    'cta.submit':       'Enviar Solicitud',
    'cta.register':     'Crear Cuenta',
    'cta.login':        'Iniciar Sesión',
    'cta.logout':       'Cerrar Sesión',

    'section.services':  'Servicios',
    'section.stats':     'En Números',
    'section.about':     'Por Qué Nosotros',
    'section.values':    'Nuestros Valores',
    'section.team':      'Nuestro Equipo',
    'section.insights':  'Artículos',
    'section.contact':   'Comenzar',

    'services.title':    'Adaptados a sus necesidades',
    'values.title':      'Guiados por integridad, confianza y enfoque en el cliente',
    'insights.title':    'Perspectivas valiosas que potencian sus decisiones',

    'stats.years':       'Años de Experiencia',
    'stats.clients':     'Clientes Atendidos',
    'stats.aum':         'Activos Bajo Gestión',
    'stats.specialists': 'Especialistas',

    'contact.headline':  'Programe su consulta personalizada.',
    'contact.sub':       'Complete el formulario y uno de nuestros consultores senior se pondrá en contacto en un día hábil.',

    'form.firstname':    'Nombre',
    'form.lastname':     'Apellido',
    'form.email':        'Correo Electrónico',
    'form.phone':        'Número de Teléfono',
    'form.message':      'Mensaje',
    'form.country':      'País',
    'form.password':     'Contraseña',
    'form.confirm':      'Confirmar Contraseña',

    'ph.message':    'Cuéntenos sobre sus objetivos financieros…',
    'ph.password':   'Mín. 8 caracteres',

    'auth.login.title':  'Inicie sesión en su portal de inversión',
    'auth.login.btn':    'Iniciar Sesión →',
    'auth.login.forgot': '¿Olvidó su contraseña?',
    'auth.login.noact':  '¿No tiene una cuenta?',
    'auth.login.create': 'Cree una gratis',
    'auth.login.remember':'Recordarme',

    'auth.register.title': 'Cree su cuenta de inversión — es gratis',
    'auth.register.btn':   'Crear Cuenta →',
    'auth.register.have':  '¿Ya tiene una cuenta?',
    'auth.register.signin':'Iniciar sesión',

    'auth.forgot.title':  '¿Olvidó su Contraseña?',
    'auth.forgot.btn':    'Enviar Enlace →',
    'auth.reset.title':   'Establecer Nueva Contraseña',
    'auth.reset.btn':     'Actualizar Contraseña →',

    'dash.welcome':      'Bienvenido de nuevo',
    'dash.balance':      'Saldo Total',
    'dash.invested':     'Total Invertido',
    'dash.profit':       'Ganancia Total',
    'dash.withdrawn':    'Total Retirado',
    'dash.invest.now':   'Invertir Ahora',
    'dash.profile.save': 'Guardar Cambios',

    'footer.privacy':    'Política de Privacidad',
    'footer.terms':      'Términos de Uso',
  },

  // ── GERMAN ──────────────────────────────────────────────────
  de: {
    'nav.services':  'Leistungen',
    'nav.about':     'Über Uns',
    'nav.insights':  'Einblicke',
    'nav.contact':   'Kontakt',
    'nav.portal':    'Kundenportal',
    'nav.dashboard': 'Mein Dashboard',

    'hero.eyebrow':  'Finanzberatung & Vermögensverwaltung',
    'hero.sub':      'Erstklassige Finanzberatungs- und Vermögensverwaltungsdienstleistungen, maßgeschneidert für Ihre Ziele und langfristige Vision.',

    'cta.portal':       'Kundenportal →',
    'cta.consultation': 'Kostenlose Beratung Vereinbaren',
    'cta.explore':      'Leistungen Entdecken',
    'cta.about':        'Über Uns',
    'cta.submit':       'Anfrage Senden',
    'cta.register':     'Konto Erstellen',
    'cta.login':        'Anmelden',
    'cta.logout':       'Abmelden',

    'section.services':  'Leistungen',
    'section.stats':     'Zahlen & Fakten',
    'section.about':     'Warum Wir',
    'section.values':    'Unsere Werte',
    'section.team':      'Unser Team',
    'section.insights':  'Artikel',
    'section.contact':   'Loslegen',

    'services.title':    'Maßgeschneidert für Ihre Bedürfnisse',
    'values.title':      'Geleitet von Integrität, Vertrauen und Kundenfokus',
    'insights.title':    'Wertvolle Einblicke für fundierte Entscheidungen',

    'stats.years':       'Jahre Erfahrung',
    'stats.clients':     'Betreute Kunden',
    'stats.aum':         'Verwaltetes Vermögen',
    'stats.specialists': 'Spezialisten',

    'contact.headline':  'Vereinbaren Sie Ihre persönliche Beratung.',
    'contact.sub':       'Füllen Sie das Formular aus und einer unserer Senior-Berater wird sich innerhalb eines Werktages melden.',

    'form.firstname':    'Vorname',
    'form.lastname':     'Nachname',
    'form.email':        'E-Mail-Adresse',
    'form.phone':        'Telefonnummer',
    'form.message':      'Nachricht',
    'form.country':      'Land',
    'form.password':     'Passwort',

    'ph.message':    'Erzählen Sie uns von Ihren finanziellen Zielen…',
    'ph.password':   'Mind. 8 Zeichen',

    'auth.login.title':  'Melden Sie sich in Ihrem Anlageportal an',
    'auth.login.btn':    'Anmelden →',
    'auth.login.forgot': 'Passwort vergessen?',
    'auth.login.noact':  'Noch kein Konto?',
    'auth.login.create': 'Kostenlos erstellen',
    'auth.login.remember':'Angemeldet bleiben',

    'auth.register.title': 'Erstellen Sie Ihr Anlagekonto — kostenlos',
    'auth.register.btn':   'Konto Erstellen →',
    'auth.register.have':  'Haben Sie bereits ein Konto?',
    'auth.register.signin':'Anmelden',

    'auth.forgot.title':  'Passwort Vergessen?',
    'auth.forgot.btn':    'Link Senden →',
    'auth.reset.title':   'Neues Passwort Festlegen',
    'auth.reset.btn':     'Passwort Aktualisieren →',

    'dash.welcome':      'Willkommen zurück',
    'dash.balance':      'Gesamtguthaben',
    'dash.invested':     'Gesamt Investiert',
    'dash.profit':       'Gesamtgewinn',
    'dash.withdrawn':    'Gesamt Abgehoben',
    'dash.invest.now':   'Jetzt Investieren',
    'dash.profile.save': 'Änderungen Speichern',

    'footer.privacy':    'Datenschutzrichtlinie',
    'footer.terms':      'Nutzungsbedingungen',
  },

  // ── CHINESE ──────────────────────────────────────────────────
  zh: {
    'nav.services':  '服务',
    'nav.about':     '关于我们',
    'nav.insights':  '洞察',
    'nav.contact':   '联系',
    'nav.portal':    '客户门户',
    'nav.dashboard': '我的仪表板',

    'hero.eyebrow':  '金融咨询与资产管理',
    'hero.sub':      '量身定制的优质金融咨询和资产管理服务，符合您的目标、风险偏好和长远愿景。',

    'cta.portal':       '客户门户 →',
    'cta.consultation': '预约免费咨询',
    'cta.explore':      '探索服务',
    'cta.about':        '关于我们',
    'cta.submit':       '提交申请',
    'cta.register':     '创建账户',
    'cta.login':        '登录',
    'cta.logout':       '退出',

    'section.services':  '服务',
    'section.stats':     '数字',
    'section.about':     '为什么选择我们',
    'section.values':    '我们的价值观',
    'section.team':      '我们的团队',
    'section.insights':  '文章',
    'section.contact':   '开始',

    'services.title':    '满足您的需求',
    'values.title':      '以诚信、信任和以客户为中心为指导',
    'insights.title':    '赋能您决策的宝贵见解',

    'stats.years':       '年经验',
    'stats.clients':     '服务客户',
    'stats.aum':         '管理资产',
    'stats.specialists': '专业人员',

    'contact.headline':  '预约您的个性化咨询。',
    'contact.sub':       '填写表格，我们的高级顾问将在一个工作日内与您联系。',

    'form.firstname':    '名字',
    'form.lastname':     '姓氏',
    'form.email':        '电子邮件地址',
    'form.phone':        '电话号码',
    'form.message':      '留言',
    'form.country':      '国家',
    'form.password':     '密码',

    'ph.message':    '告诉我们您的财务目标…',
    'ph.password':   '至少8个字符',

    'auth.login.title':  '登录您的投资门户',
    'auth.login.btn':    '登录 →',
    'auth.login.forgot': '忘记密码？',
    'auth.login.noact':  '还没有账户？',
    'auth.login.create': '免费创建',
    'auth.login.remember':'记住我',

    'auth.register.title': '创建您的投资账户 — 免费',
    'auth.register.btn':   '创建账户 →',
    'auth.register.have':  '已有账户？',
    'auth.register.signin':'登录',

    'auth.forgot.title':  '忘记密码？',
    'auth.forgot.btn':    '发送链接 →',
    'auth.reset.title':   '设置新密码',
    'auth.reset.btn':     '更新密码 →',

    'dash.welcome':      '欢迎回来',
    'dash.balance':      '总余额',
    'dash.invested':     '总投资',
    'dash.profit':       '总利润',
    'dash.withdrawn':    '总提款',
    'dash.invest.now':   '立即投资',
    'dash.profile.save': '保存更改',

    'footer.privacy':    '隐私政策',
    'footer.terms':      '使用条款',
  },

  // ── ARABIC (RTL) ─────────────────────────────────────────────
  ar: {
    'nav.services':  'الخدمات',
    'nav.about':     'من نحن',
    'nav.insights':  'رؤى',
    'nav.contact':   'تواصل',
    'nav.portal':    'بوابة العميل',
    'nav.dashboard': 'لوحتي',

    'hero.eyebrow':  'الاستشارات المالية وإدارة الأصول',
    'hero.sub':      'خدمات استشارات مالية وإدارة أصول متميزة مصممة وفقًا لأهدافك وملفك الشخصي للمخاطر ورؤيتك طويلة الأمد.',

    'cta.portal':       'بوابة العميل →',
    'cta.consultation': 'جدولة استشارة مجانية',
    'cta.explore':      'استكشف الخدمات',
    'cta.about':        'من نحن',
    'cta.submit':       'إرسال الطلب',
    'cta.register':     'إنشاء حساب',
    'cta.login':        'تسجيل الدخول',
    'cta.logout':       'تسجيل الخروج',

    'section.services':  'الخدمات',
    'section.stats':     'بالأرقام',
    'section.about':     'لماذا نحن',
    'section.values':    'قيمنا',
    'section.team':      'فريقنا',
    'section.insights':  'مقالات',
    'section.contact':   'ابدأ',

    'services.title':    'مصممة لتلبية احتياجاتك',
    'values.title':      'موجهون بالنزاهة والثقة والتركيز على العميل',
    'insights.title':    'رؤى قيّمة تعزز قراراتك',

    'stats.years':       'سنوات الخبرة',
    'stats.clients':     'العملاء المخدومون',
    'stats.aum':         'الأصول المدارة',
    'stats.specialists': 'المتخصصون',

    'contact.headline':  'جدولة استشارتك الشخصية.',
    'contact.sub':       'أدخل بياناتك وسيتواصل معك أحد كبار مستشارينا خلال يوم عمل واحد.',

    'form.firstname':    'الاسم الأول',
    'form.lastname':     'اسم العائلة',
    'form.email':        'البريد الإلكتروني',
    'form.phone':        'رقم الهاتف',
    'form.message':      'الرسالة',
    'form.country':      'الدولة',
    'form.password':     'كلمة المرور',

    'ph.message':    'أخبرنا عن أهدافك المالية…',
    'ph.password':   '٨ أحرف على الأقل',

    'auth.login.title':  'تسجيل الدخول إلى بوابة الاستثمار',
    'auth.login.btn':    'تسجيل الدخول →',
    'auth.login.forgot': 'نسيت كلمة المرور؟',
    'auth.login.noact':  'ليس لديك حساب؟',
    'auth.login.create': 'أنشئ حسابًا مجانًا',
    'auth.login.remember':'تذكرني',

    'auth.register.title': 'أنشئ حسابك الاستثماري — مجانًا',
    'auth.register.btn':   'إنشاء حساب →',
    'auth.register.have':  'لديك حساب بالفعل؟',
    'auth.register.signin':'تسجيل الدخول',

    'auth.forgot.title':  'نسيت كلمة المرور؟',
    'auth.forgot.btn':    'إرسال الرابط →',
    'auth.reset.title':   'تعيين كلمة مرور جديدة',
    'auth.reset.btn':     'تحديث كلمة المرور →',

    'dash.welcome':      'مرحبًا بعودتك',
    'dash.balance':      'الرصيد الإجمالي',
    'dash.invested':     'إجمالي الاستثمار',
    'dash.profit':       'إجمالي الأرباح',
    'dash.withdrawn':    'إجمالي السحوبات',
    'dash.invest.now':   'استثمر الآن',
    'dash.profile.save': 'حفظ التغييرات',

    'footer.privacy':    'سياسة الخصوصية',
    'footer.terms':      'شروط الاستخدام',
  },
};

// ── SUPPORTED LANGUAGES ───────────────────────────────────────
export const LANGUAGES = [
  { code: 'en', label: 'English',   flag: '🇺🇸' },
  { code: 'fr', label: 'Français',  flag: '🇫🇷' },
  { code: 'es', label: 'Español',   flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch',   flag: '🇩🇪' },
  { code: 'zh', label: '中文',       flag: '🇨🇳' },
  { code: 'ar', label: 'العربية',   flag: '🇸🇦' },
];

// ── STATE ─────────────────────────────────────────────────────
let _lang = 'en';

// ── CORE FUNCTIONS ────────────────────────────────────────────

/**
 * Get the current language code.
 */
export function getLang() { return _lang; }

/**
 * Translate a key. Falls back to English, then the key itself.
 * @param {string} key
 * @returns {string}
 */
export function t(key) {
  const trs = TRANSLATIONS[_lang] || TRANSLATIONS.en;
  return trs[key] ?? TRANSLATIONS.en[key] ?? key;
}

/**
 * Auto-detect language from browser, respecting localStorage preference.
 */
export function detectLang() {
  const stored = localStorage.getItem('hcp_lang');
  if (stored && TRANSLATIONS[stored]) return stored;
  const browser = (navigator.language || navigator.userLanguage || 'en').split('-')[0];
  return TRANSLATIONS[browser] ? browser : 'en';
}

/**
 * Switch language, persist, and apply to DOM.
 * @param {string} code  — e.g. 'fr'
 */
export function setLang(code) {
  if (!TRANSLATIONS[code]) return;
  _lang = code;
  localStorage.setItem('hcp_lang', code);
  applyToDOM();
  updateSwitcherState(code);
  // Close dropdown if open
  const ls = document.getElementById('lang-switch');
  if (ls) ls.classList.remove('open');
  document.dispatchEvent(new CustomEvent('hcp:langchange', { detail: { lang: code } }));
}

/**
 * Initialize i18n — detect language and apply to DOM.
 * Call once on every page after DOMContentLoaded.
 */
export function initI18n() {
  _lang = detectLang();
  // Expose to window so inline onclick="setLang('fr')" works from non-module scripts
  window.setLang   = setLang;
  window.toggleLang = toggleLang;
  applyToDOM();
  bindSwitcher();
}

// ── DOM APPLICATION ───────────────────────────────────────────

/**
 * Apply all translations to the current DOM.
 * Handles: data-i18n, data-i18n-placeholder, data-i18n-aria, RTL
 */
export function applyToDOM() {
  // Text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const val = t(el.dataset.i18n);
    if (val !== el.dataset.i18n) el.textContent = val; // only update if translated
  });

  // Input placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const val = t(el.dataset.i18nPlaceholder);
    if (val !== el.dataset.i18nPlaceholder) el.placeholder = val;
  });

  // Aria labels
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const val = t(el.dataset.i18nAria);
    if (val !== el.dataset.i18nAria) el.setAttribute('aria-label', val);
  });

  // HTML lang attribute
  document.documentElement.lang = _lang;

  // RTL for Arabic
  document.documentElement.dir = _lang === 'ar' ? 'rtl' : 'ltr';

  // Update lang indicator elements
  document.querySelectorAll('#lang-current, [data-lang-current]').forEach(el => {
    el.textContent = _lang.toUpperCase();
  });
}

// ── SWITCHER BINDING ──────────────────────────────────────────

/**
 * Bind click events to .lang-opt elements.
 * Safe to call multiple times (uses flag).
 */
let _switcherBound = false;
export function bindSwitcher() {
  if (_switcherBound) return;
  _switcherBound = true;

  // Toggle dropdown open/close
  const langSwitch = document.getElementById('lang-switch');
  const langBtn    = document.querySelector('.lang-btn');
  if (langBtn && langSwitch) {
    langBtn.addEventListener('click', e => {
      e.stopPropagation();
      langSwitch.classList.toggle('open');
    });
    document.addEventListener('click', e => {
      if (!langSwitch.contains(e.target)) langSwitch.classList.remove('open');
    });
  }

  // Language option clicks — skip opts that already have inline onclick to avoid double-fire
  document.querySelectorAll('.lang-opt[data-lang]').forEach(opt => {
    if (opt.getAttribute('onclick')) return; // inline onclick already calls setLang via window.setLang
    opt.addEventListener('click', () => {
      setLang(opt.dataset.lang);
      langSwitch?.classList.remove('open');
    });
  });

  updateSwitcherState(_lang);
}

function updateSwitcherState(code) {
  document.querySelectorAll('.lang-opt[data-lang]').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.lang === code);
  });
}

/**
 * Render a complete language switcher into a container element.
 * Use this to inject the switcher on pages that don't have it in HTML.
 *
 * @param {string|Element} container — selector or element
 */
export function renderSwitcher(container) {
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  if (!el) return;

  el.innerHTML = `
    <div class="lang-switch" id="lang-switch">
      <button class="lang-btn" type="button">
        🌐 <span id="lang-current">${_lang.toUpperCase()}</span> ▾
      </button>
      <div class="lang-dropdown">
        ${LANGUAGES.map(l => `
          <div class="lang-opt${l.code === _lang ? ' active' : ''}" data-lang="${l.code}">
            ${l.flag} ${l.label}
          </div>`).join('')}
      </div>
    </div>`;

  _switcherBound = false; // allow rebind
  bindSwitcher();
}
