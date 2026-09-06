/* =============================================================
   English / Khmer for the whole site.

   How it works:
     * mark text in the HTML with data-i18n="key" (or data-i18n-html for
       strings containing a link, data-i18n-placeholder / -title / -aria)
     * call t("key", { vars }) from JavaScript for anything rendered
     * anything that renders itself should listen for "i18n:change" and
       re-render, which is what the language button triggers

   House rule for the Khmer strings, straight from the brief: words that
   only make sense in English stay in English. Minecraft vocabulary
   (Server, Rank, Keys, Java, Bedrock, Creeper, Zombie, Combo, KHQR,
   Telegram, Discord, block names...) is never translated - it would read
   strangely to a Khmer player who knows the game in English.
   ============================================================= */
const I18n = (() => {
  const LANG_KEY = "makong-lang";
  const RIEL_PER_USD = 4000;

  const DICT = {
    en: {
      /* ---- nav / chrome ---- */
      "nav.home": "Home",
      "nav.store": "Store",
      "nav.ranking": "Ranking",
      "nav.menu": "Menu",
      "nav.language": "Language",
      "footer.copy": "© {year} Makong Network · Asia Minecraft Server 🌏",

      /* ---- home ---- */
      "home.discord": "Discord",
      "home.discordSub": "Join our community",
      "home.copyIp": "Click to copy IP",
      "home.tapJoin": "Tap to join (Bedrock)",
      "home.store": "Store",
      "home.storeSub": "Ranks, keys & more",
      "home.checking": "Checking server status…",
      "home.online": "{online} Players",
      "home.offline": "Server offline",
      "home.statusUnavailable": "Status unavailable",
      "home.welcome": "Welcome",
      "home.copied": 'Copied "{ip}" — paste it into Minecraft > Multiplayer > Add Server',
      "home.opening": "Opening Minecraft (Bedrock)… Java IP also copied just in case!",

      /* ---- store ---- */
      "store.subtitle": "STORE",
      "store.gamemode": "Gamemode",
      "store.changeRegion": "Change store",
      "region.title": "Select your region",
      "region.subtitle": "This decides how you'll pay. You can change it any time.",
      "region.khmer": "Cambodia",
      "region.khmerDesc": "Pay with KHQR",
      "region.global": "Global",
      "region.globalDesc": "Pay via Tebex",
      "store.gateTitle": "Who is this for?",
      "store.gateHint":
        "Enter your Minecraft name once so we know where to deliver your purchase — and so we can show your current rank and coins.",
      "store.unavailableTitle": "Unavailable",
      "store.unavailableBody":
        "The store is probably under maintenance or offline for now. Please check back later, or contact support if this keeps happening.",
      "store.loggedInAs": "Logged in as",
      "store.noRank": "No rank yet",
      "store.upgradeNow": "Upgrade Now",
      "store.currentRank": "Your current Rank",
      "store.lowerRank": "This is a lower rank",
      "store.alreadyOwned": "You already have this",
      "store.upRank": "Up Rank",
      "store.upRankChoose": "Choose a rank to upgrade from",
      "store.upgradeSummary": "Upgrade {from} → {to}",
      "store.upgradeCaption": "You are upgrading {from} to {to}",
      "store.confirmName": "Name",
      "store.confirmPlatform": "Platform",
      "store.duration1Month": "1 Month",
      "store.durationPermanent": "Permanent",
      "store.quantity": "Quantity",
      "store.qtyDecrease": "Decrease quantity",
      "store.qtyIncrease": "Increase quantity",
      "store.confirm": "Confirm",
      "store.cancel": "Cancel",
      "store.changeHint":
        "This is the name your purchases are delivered to, and the account your website coins and points are saved under.",
      "store.tab.ranks": "Ranks",
      "store.tab.keys": "Keys",
      "store.tab.other": "Other",
      "store.empty": "No items here yet — check back soon!",
      "store.comingSoon": "Coming Soon",
      "store.buyNow": "Buy Now",
      "store.infoTitle": "Item info & kit video",
      "buy.title": "Buy: {item}",
      "buy.username": "Minecraft username",
      "buy.edition": "Edition",
      "buy.java": "Java",
      "buy.bedrock": "Bedrock",
      "buy.inServerName": "In server name: {name}",
      "buy.continue": "Continue",
      "buy.wait": "Please wait…",
      "buy.invalidJava": "Enter a valid Java username (letters, numbers, underscore).",
      "buy.invalidBedrock": "Enter a valid Bedrock gamertag (letters, numbers, spaces or underscores).",

      /* ---- checkout ---- */
      "checkout.title": "🌿 Complete your Purchase 🌿",
      "checkout.loading": "Loading your order…",
      "checkout.inServerName": "In server name",
      "checkout.edition": "Edition",
      "checkout.duration": "Duration",
      "checkout.total": "Total",
      "checkout.step1": "1. Scan to pay",
      "checkout.scanHint": "Scan this KHQR with any Cambodian banking app and pay exactly {amount}.",
      "checkout.saveKhqr": "💾 Save KHQR",
      "checkout.saveHint": "Save it, then scan from your banking app's photo library.",
      "checkout.step2": "2. Upload your payment screenshot",
      "checkout.uploadHint": "After paying, attach a screenshot of the transaction receipt so we can verify it.",
      "checkout.dropText": "Tap to choose a screenshot, or drag one here",
      "checkout.submit": "SUBMIT",
      "checkout.submitNote": "Attach your receipt to enable Submit.",
      "checkout.ready": "Ready to submit.",
      "checkout.submitting": "Submitting…",
      "checkout.sending": "Sending your receipt…",
      "checkout.retry": "Something went wrong — please try again.",
      "checkout.trouble": "Having trouble?",
      "checkout.contactSupport": "Contact support on Telegram",
      "checkout.notImage": "Please choose an image file (a screenshot of your receipt).",
      "checkout.tooBig": "That image is larger than 8 MB — please use a smaller screenshot.",
      "checkout.noOrder": "No order specified.",
      "checkout.backToStore": "Back to the store",
      "checkout.loadFailed": "Couldn't load that order ({error}).",
      "checkout.khqrMissing": "KHQR image not uploaded yet — add it at public/images/site/khqr.png",
      "checkout.orTebex": "Or pay instantly",
      "checkout.tebexHint": "Pay by card or Tebex Wallet through Tebex's secure checkout — confirmed automatically, no screenshot needed.",
      "checkout.payTebex": "Pay via Tebex",
      "checkout.tebexVerifying": "Confirming your Tebex payment…",
      "checkout.tebexNotPaid": "We haven't received your payment yet. If you completed checkout, give it a moment and try again.",
      "checkout.tebexCheckAgain": "Check again",
      "checkout.tebexFailed": "Couldn't start Tebex checkout — please try again or pay by KHQR below.",
      "checkout.tebexError": "Something went wrong confirming your Tebex payment ({error}).",

      /* ---- success ---- */
      "success.title": "Submit successful!",
      "success.body":
        "Thanks! Your payment receipt has been sent to the owner for review. Please wait for them to confirm your payment — your item is usually delivered in-game within a few minutes.",
      "success.item": "Item",
      "success.amount": "Amount",
      "success.orderId": "Order ID",
      "success.supportLine": "Haven't received your items after an hour? Please contact support.",
      "success.supportLineLink": "Haven't received your items after an hour?",
      "success.back": "Back to home",

      /* ---- ranking ---- */
      "ranking.subtitle": "RANKING",
      "ranking.tab.teams": "Top Team",
      "ranking.tab.players": "Top Player",
      "ranking.stat.star": "Star",
      "ranking.empty": "No rankings yet — check back soon!",
      "ranking.loading": "Loading rankings…",
      "ranking.source.live": "🟢 Live from the server",
      "ranking.source.sample": "Sample rankings",

      /* ---- games: gate + hub ---- */
      "games.subtitle": "GAMES",
      "games.verify": "Verify",
      "games.coins": "Coins",
      "games.topPoints": "Top Points",
      "games.viewFull": "View full",
      "games.earnedToday": "earned {earned}/{cap} today",
      "games.playsLeft": "{left} of {cap} plays left today",
      "games.noPlaysLeft": "No plays left today",
      "games.noPlaysLeftToast": "You've used all 3 plays of this game today. Come back after the reset.",
      "games.cannotStart": "Can't start this round",
      "games.go": "GO!",

      "games.gateTitle": "Play & earn coins",
      "games.gateHint":
        "Play mini-games right here on the website and earn Makong Coins for your in-game balance. Enter your Minecraft name once — we'll remember it next time.",
      "games.unavailableTitle": "Unavailable",
      "games.unavailableBody":
        "Games are probably under maintenance or offline for now. Please check back later, or contact support if this keeps happening.",
      "games.coinsUnavailable": "Unavailable",
      "games.coinBannerText": "⚠️ Coins won't be received right now — the coin system is unavailable. Contact support for more info.",
      "games.start": "Start Playing",
      "games.disclaimer":
        "Your name is saved on this device, so you only enter it once. Coins and points are stored on the server.",
      "games.playingAs": "Playing as",
      "games.changeName": "Change name",
      "games.changeLocked": "Name locked · {time} left",
      "games.changeTitle": "Change your name",
      "games.changeHint":
        "Your name is what your coins and points are saved under, so it can only be changed once a day.",
      "games.changeConfirm": "Save new name",
      "games.changeCancel": "Cancel",
      "games.nameSaved": "Your name is now {name}.",
      "games.nameLockedToast": "You can change your name again in {time}.",
      "games.welcomeBack": "Welcome back, {name}!",
      "games.points": "Points",
      "games.pointsSub": "Rounds this session",
      "games.coinsToday": "Coins Today",
      "games.dailyLimit": "of {cap} daily limit",
      "games.resetsIn": "Resets in {time}",
      "games.leaderboard": "Points Leaderboard",
      "games.leaderboardOpen": "Open Leaderboard",
      "games.leaderboardTitle": "🏆 Points Leaderboard",
      "games.leaderboardSub": "Top 50 players by lifetime points.",
      "games.leaderboardEmpty": "No scores yet — play a round and claim the top spot!",
      "games.leaderboardYou": "You",
      "games.leaderboardRank": "#",
      "games.leaderboardPlayer": "Player",
      "games.leaderboardPoints": "Points",
      "games.leaderboardYourRank": "Your rank: #{rank} · {points} points",
      "games.leaderboardUnranked": "Play a round to join the leaderboard.",
      "games.listHeading": "Mini-games",
      "games.listHint":
        "3 plays of each game a day, 1–75 Coins a play, up to 1,000 Coins a day total. Resets at midnight (UTC+7).",
      "games.play": "Play",
      "games.todaysReward": "Today's Reward: {earned} / {cap} Coins",
      "games.dailyComplete": "Daily Reward Complete!",
      "games.dailyCompleteFull": "Daily Reward Complete! {cap} / {cap} Coins",
      "games.dailyCompleteNote": "You can keep playing for fun, but won't earn more Coins today.",
      "games.rewardNote": "Earn up to <strong>1,000 Coins</strong> a day from this game.",
      "games.startBtn": "Start",

      /* ---- games: in-game HUD ---- */
      "hud.points": "Points",
      "hud.time": "Time",
      "hud.streak": "Streak",
      "hud.lives": "Lives",
      "hud.dodges": "Dodges",
      "hud.survived": "Survived",
      "hud.diamonds": "Diamonds",
      "hud.height": "Height",
      "hud.ores": "Ores",
      "hud.toGo": "To go",
      "hud.deaths": "Falls",
      "hud.hearts": "Hearts",
      "hud.level": "Level",

      /* ---- games: the five games ---- */
      "game.lava.name": "Lava Run",
      "game.lava.desc": "Climb 100m before the rising lava catches you. Grab diamonds on the way up.",
      "game.lava.howto":
        "Drag left and right to steer — you bounce automatically. Diamond +5 · Checkpoint +15 · Finish +100, plus a point per metre climbed and a bonus for a fast time. The rail on the left shows the finish, you, and the lava.",
      "game.lava.hint": "Drag to steer · 💎 +15 · 🏃 +15 · 🏆 +100",

      "game.breaker.name": "Block Breaker",
      "game.breaker.desc": "Break only the block shown at the top. Four levels, ten blocks each, and the grid keeps growing.",
      "game.breaker.howto":
        "Break ten of the target block to clear a level. Later levels are worth more, and clearing all four pays the maximum. A wrong block costs you a second off the clock.",
      "game.breaker.hint": "10 blocks a level · Wrong block = -1 second",
      "game.breaker.target": "BREAK",
      "game.breaker.penalty": "-1s",

      "game.dodge.name": "Wind Charge Dodge",
      "game.dodge.desc": "Dodge the wind charges, grab emeralds, survive as long as you can.",
      "game.dodge.howto":
        "Drag to move (or use the arrow keys). Grazing a wind charge pays +2 and emeralds are +5. One hit ends the run.",
      "game.dodge.hint": "Drag to move · Close dodge +2 · Emerald +5",

      "game.rush.name": "Diamond Rush",
      "game.rush.desc": "Thirty seconds to mine as much value as you can. One tap on TNT and it's over.",
      "game.rush.howto":
        "Coal +1 · Iron +2 · Gold +4 · Diamond +8 · Emerald +12. TNT ends the run on the spot, and the seam reshuffles faster and faster — so look before you swing.",
      "game.rush.hint": "Coal +1 · Iron +2 · Gold +4 · Diamond +8 · Emerald +12 · TNT = over",
      "game.rush.rubble": "Rubble",

      "game.tnt.name": "TNT Escape",
      "game.tnt.desc": "Survive 45 seconds in an arena raining TNT. Keep moving.",
      "game.tnt.howto":
        "Drag to move (or use the arrow keys). Each TNT shows its blast circle before it goes off — stay out of it. Standing just outside pays +5, and you get +3 for every second alive.",
      "game.tnt.hint": "Drag to move · Stay out of the red · Close call +5",

      /* ---- games: result screen ---- */
      "result.headline": "Nice run!",
      "result.coinsEarned": "Coins earned",
      "result.playAgain": "Play Again",
      "result.backToGames": "← Back to games",
      "result.saveFailed": "Couldn't reach the server, so this round's coins weren't saved.",
      "result.height": "Height climbed",
      "result.diamonds": "Diamonds",
      "result.checkpoints": "Checkpoints",
      "result.runTime": "Time",
      "result.outcome": "Result",
      "result.deaths": "Falls",
      "result.finished": "🏆 Reached the finish!",
      "result.perfectRun": "✨ Perfect run — no falls!",
      "result.burned": "🌋 Caught by the lava",
      "result.gaveUp": "⏱️ Ran out of time",
      "result.outOfHearts": "💔 Out of hearts",
      "result.blownUp": "💥 Blown up",
      "result.survivedAll": "🏆 Survived to the end!",
      "result.timeUp": "⏱️ Time's up",
      "result.allCleared": "🏆 All four levels cleared!",
      "result.levelsCleared": "Levels cleared",
      "result.blocksBroken": "Blocks broken",
      "result.wrongBlocks": "Wrong blocks",
      "result.timeLost": "Time lost",
      "result.survived": "Survived",
      "result.dodges": "Close dodges",
      "result.emeralds": "Emeralds",
      "result.oresMined": "Ores mined",
      "result.gems": "Diamonds & Emeralds",
      "result.bestFind": "Best find",

      /* ---- block names (kept in English on purpose) ---- */
      "block.grass": "Grass Block",
      "block.stone": "Stone",
      "block.dirt": "Dirt",
      "block.planks": "Planks",
      "block.gold": "Gold Block",
      "block.diamond": "Diamond",
      "block.redstone": "Redstone",
      "block.lapis": "Lapis",
      "block.emerald": "Emerald",
      "block.obsidian": "Obsidian",
      "block.sand": "Sand",

      /* ---- ore names for Diamond Rush (English on purpose too) ---- */
      "ore.stone": "Stone",
      "ore.coal": "Coal",
      "ore.iron": "Iron",
      "ore.gold": "Gold",
      "ore.diamond": "Diamond",
      "ore.emerald": "Emerald",
      "ore.tnt": "TNT",
    },

    km: {
      /* ---- nav / chrome ---- */
      "nav.home": "ទំព័រដើម",
      "nav.store": "ហាង",
      "nav.ranking": "ចំណាត់ថ្នាក់",
      "nav.menu": "ម៉ឺនុយ",
      "nav.language": "ភាសា",
      "footer.copy": "© {year} Makong Network · Minecraft Server អាស៊ី 🌏",

      /* ---- home ---- */
      "home.discord": "Discord",
      "home.discordSub": "ចូលរួមសហគមន៍យើង",
      "home.copyIp": "ចុចដើម្បីចម្លង IP",
      "home.tapJoin": "ចុចដើម្បីចូល (Bedrock)",
      "home.store": "ហាង",
      "home.storeSub": "Ranks, Keys និងច្រើនទៀត",
      "home.checking": "កំពុងពិនិត្យស្ថានភាព Server…",
      "home.online": "អ្នកលេង {online} នាក់",
      "home.offline": "Server Offline",
      "home.statusUnavailable": "មិនអាចពិនិត្យស្ថានភាពបានទេ",
      "home.welcome": "សូមស្វាគមន៍",
      "home.copied": 'បានចម្លង "{ip}" — សូមដាក់ក្នុង Minecraft > Multiplayer > Add Server',
      "home.opening": "កំពុងបើក Minecraft (Bedrock)… IP Java ក៏បានចម្លងទុកដែរ!",

      /* ---- store ---- */
      "store.subtitle": "ហាង",
      "store.gamemode": "ប្រភេទហ្គេម",
      "store.changeRegion": "ប្តូរតំបន់ហាង",
      "region.title": "ជ្រើសរើសតំបន់របស់អ្នក",
      "region.subtitle": "វានឹងកំណត់វិធីបង់ប្រាក់របស់អ្នក។ អ្នកអាចផ្លាស់ប្តូរបានគ្រប់ពេល។",
      "region.khmer": "កម្ពុជា",
      "region.khmerDesc": "បង់ប្រាក់តាម KHQR",
      "region.global": "Global",
      "region.globalDesc": "បង់ប្រាក់តាម Tebex",
      "store.gateTitle": "ទិញសម្រាប់អ្នកណា?",
      "store.gateHint":
        "បញ្ចូលឈ្មោះ Minecraft តែម្តងគត់ ដើម្បីយើងដឹងថាត្រូវផ្ញើទំនិញទៅណា — ហើយអាចបង្ហាញ Rank និង Coins បច្ចុប្បន្នរបស់អ្នក។",
      "store.unavailableTitle": "មិនអាចប្រើបានទេ",
      "store.unavailableBody":
        "ហាងប្រហែលជានៅក្នុងការជួសជុល ឬបិទជាបណ្តោះអាសន្ន។ សូមមកមើលម្តងទៀតពេលក្រោយ ឬទាក់ទង Support បើនៅតែមានបញ្ហា។",
      "store.loggedInAs": "ចូលជា",
      "store.noRank": "មិនទាន់មាន Rank",
      "store.upgradeNow": "ដំឡើងឥឡូវ",
      "store.currentRank": "Rank បច្ចុប្បន្នរបស់អ្នក",
      "store.lowerRank": "នេះជា Rank ទាបជាង",
      "store.alreadyOwned": "អ្នកមានរួចហើយ",
      "store.upRank": "ដំឡើង Rank",
      "store.upRankChoose": "ជ្រើសរើស Rank ដើម្បីដំឡើងពី",
      "store.upgradeSummary": "ដំឡើងពី {from} → {to}",
      "store.upgradeCaption": "អ្នកកំពុងដំឡើងពី {from} ទៅ {to}",
      "store.confirmName": "ឈ្មោះ",
      "store.confirmPlatform": "Platform",
      "store.duration1Month": "១ ខែ",
      "store.durationPermanent": "អចិន្ត្រៃយ៍",
      "store.quantity": "ចំនួន",
      "store.qtyDecrease": "បន្ថយចំនួន",
      "store.qtyIncrease": "បន្ថែមចំនួន",
      "store.confirm": "បញ្ជាក់",
      "store.cancel": "បោះបង់",
      "store.changeHint":
        "នេះជាឈ្មោះដែលទំនិញនឹងផ្ញើទៅ និងជាគណនីដែលរក្សាទុក Coins និងពិន្ទុរបស់អ្នក។",
      "store.tab.ranks": "Ranks",
      "store.tab.keys": "Keys",
      "store.tab.other": "ផ្សេងៗ",
      "store.empty": "មិនទាន់មានទំនិញនៅទីនេះទេ — សូមមកមើលម្តងទៀតឆាប់ៗ!",
      "store.comingSoon": "ឆាប់ៗនេះ",
      "store.buyNow": "ទិញឥឡូវ",
      "store.infoTitle": "ព័ត៌មានទំនិញ និងវីដេអូ Kit",
      "buy.title": "ទិញ៖ {item}",
      "buy.username": "ឈ្មោះ Minecraft",
      "buy.edition": "Edition",
      "buy.java": "Java",
      "buy.bedrock": "Bedrock",
      "buy.inServerName": "ឈ្មោះក្នុង Server៖ {name}",
      "buy.continue": "បន្ត",
      "buy.wait": "សូមរង់ចាំ…",
      "buy.invalidJava": "សូមបញ្ចូលឈ្មោះ Java ត្រឹមត្រូវ (អក្សរ លេខ ឬ underscore)។",
      "buy.invalidBedrock": "សូមបញ្ចូល Bedrock gamertag ត្រឹមត្រូវ (អក្សរ លេខ ចន្លោះ ឬ underscore)។",

      /* ---- checkout ---- */
      "checkout.title": "🌿 បញ្ចប់ការទិញរបស់អ្នក 🌿",
      "checkout.loading": "កំពុងផ្ទុកការបញ្ជាទិញ…",
      "checkout.inServerName": "ឈ្មោះក្នុង Server",
      "checkout.edition": "Edition",
      "checkout.duration": "រយៈពេល",
      "checkout.total": "សរុប",
      "checkout.step1": "១. ស្កេនដើម្បីបង់ប្រាក់",
      "checkout.scanHint": "ស្កេន KHQR នេះជាមួយ App ធនាគារកម្ពុជាណាមួយ ហើយបង់ឲ្យត្រូវ {amount}។",
      "checkout.saveKhqr": "💾 រក្សាទុក KHQR",
      "checkout.saveHint": "រក្សាទុករូបភាព រួចស្កេនពី Gallery ក្នុង App ធនាគាររបស់អ្នក។",
      "checkout.step2": "២. បញ្ចូលរូបថតអេក្រង់នៃការបង់ប្រាក់",
      "checkout.uploadHint": "បន្ទាប់ពីបង់ប្រាក់រួច សូមភ្ជាប់រូបថតអេក្រង់នៃបង្កាន់ដៃ ដើម្បីឲ្យយើងផ្ទៀងផ្ទាត់។",
      "checkout.dropText": "ចុចដើម្បីជ្រើសរូបថតអេក្រង់ ឬអូសរូបមកទីនេះ",
      "checkout.submit": "ដាក់ស្នើ",
      "checkout.submitNote": "សូមភ្ជាប់បង្កាន់ដៃជាមុនសិន ទើបអាចដាក់ស្នើបាន។",
      "checkout.ready": "រួចរាល់ដើម្បីដាក់ស្នើ។",
      "checkout.submitting": "កំពុងដាក់ស្នើ…",
      "checkout.sending": "កំពុងផ្ញើបង្កាន់ដៃរបស់អ្នក…",
      "checkout.retry": "មានបញ្ហាបន្តិច — សូមព្យាយាមម្តងទៀត។",
      "checkout.trouble": "មានបញ្ហាមែនទេ?",
      "checkout.contactSupport": "ទាក់ទង Support តាម Telegram",
      "checkout.notImage": "សូមជ្រើសរើសឯកសាររូបភាព (រូបថតអេក្រង់នៃបង្កាន់ដៃ)។",
      "checkout.tooBig": "រូបភាពនេះធំជាង ៨ MB — សូមប្រើរូបតូចជាងនេះ។",
      "checkout.noOrder": "គ្មានការបញ្ជាទិញត្រូវបានបញ្ជាក់ទេ។",
      "checkout.backToStore": "ត្រឡប់ទៅហាង",
      "checkout.loadFailed": "មិនអាចផ្ទុកការបញ្ជាទិញនោះបានទេ ({error})។",
      "checkout.khqrMissing": "រូប KHQR មិនទាន់បានដាក់ទេ — សូមដាក់នៅ public/images/site/khqr.png",
      "checkout.orTebex": "ឬបង់ភ្លាមៗ",
      "checkout.tebexHint": "បង់ដោយកាតឬ Tebex Wallet តាមរយៈ Checkout សុវត្ថិភាពរបស់ Tebex — បញ្ជាក់ដោយស្វ័យប្រវត្តិ មិនចាំបាច់ថតអេក្រង់ទេ។",
      "checkout.payTebex": "បង់ប្រាក់តាម Tebex",
      "checkout.tebexVerifying": "កំពុងបញ្ជាក់ការបង់ប្រាក់ Tebex របស់អ្នក…",
      "checkout.tebexNotPaid": "យើងមិនទាន់ទទួលបានការបង់ប្រាក់របស់អ្នកនៅឡើយទេ។ ប្រសិនបើអ្នកបានបញ្ចប់ Checkout ហើយ សូមរង់ចាំបន្តិច ហើយសាកល្បងម្តងទៀត។",
      "checkout.tebexCheckAgain": "ពិនិត្យម្តងទៀត",
      "checkout.tebexFailed": "មិនអាចចាប់ផ្តើម Tebex Checkout បានទេ — សូមសាកល្បងម្តងទៀត ឬបង់ដោយ KHQR ខាងក្រោម។",
      "checkout.tebexError": "មានបញ្ហាក្នុងការបញ្ជាក់ការបង់ប្រាក់ Tebex របស់អ្នក ({error})។",

      /* ---- success ---- */
      "success.title": "ដាក់ស្នើបានជោគជ័យ!",
      "success.body":
        "អរគុណ! បង្កាន់ដៃរបស់អ្នកត្រូវបានផ្ញើទៅម្ចាស់ Server ដើម្បីពិនិត្យ។ សូមរង់ចាំការបញ្ជាក់ — ជាធម្មតាទំនិញនឹងដល់ក្នុងហ្គេមក្នុងរយៈពេលប៉ុន្មាននាទី។",
      "success.item": "ទំនិញ",
      "success.amount": "ចំនួនទឹកប្រាក់",
      "success.orderId": "លេខបញ្ជាទិញ",
      "success.supportLine": "មិនទាន់ទទួលបានទំនិញក្រោយមួយម៉ោង? សូមទាក់ទង Support។",
      "success.supportLineLink": "មិនទាន់ទទួលបានទំនិញក្រោយមួយម៉ោង?",
      "success.back": "ត្រឡប់ទៅទំព័រដើម",

      /* ---- ranking ---- */
      "ranking.subtitle": "ចំណាត់ថ្នាក់",
      "ranking.tab.teams": "ក្រុមកំពូល",
      "ranking.tab.players": "កីឡាករកំពូល",
      "ranking.stat.star": "ផ្កាយ",
      "ranking.empty": "មិនទាន់មានចំណាត់ថ្នាក់ទេ — សូមមកមើលម្តងទៀតឆាប់ៗ!",
      "ranking.loading": "កំពុងផ្ទុកចំណាត់ថ្នាក់…",
      "ranking.source.live": "🟢 ផ្ទាល់ពីម៉ាស៊ីនមេ",
      "ranking.source.sample": "ចំណាត់ថ្នាក់សាកល្បង",

      /* ---- games: gate + hub ---- */
      "games.subtitle": "ហ្គេម",
      "games.verify": "ផ្ទៀងផ្ទាត់",
      "games.coins": "Coins",
      "games.topPoints": "ពិន្ទុខ្ពស់បំផុត",
      "games.viewFull": "មើលទាំងអស់",
      "games.earnedToday": "រកបាន {earned}/{cap} ថ្ងៃនេះ",
      "games.playsLeft": "នៅសល់ {left} ក្នុងចំណោម {cap} ដងថ្ងៃនេះ",
      "games.noPlaysLeft": "អស់ចំនួនលេងថ្ងៃនេះ",
      "games.noPlaysLeftToast": "អ្នកបានលេងហ្គេមនេះគ្រប់ ៣ ដងហើយថ្ងៃនេះ។ សូមត្រឡប់មកវិញក្រោយពេលកំណត់ឡើងវិញ។",
      "games.cannotStart": "មិនអាចចាប់ផ្តើមជុំនេះបានទេ",
      "games.go": "ចាប់ផ្តើម!",

      "games.gateTitle": "លេង ហើយរក Coins",
      "games.gateHint":
        "លេងហ្គេមតូចៗនៅលើ Website នេះ ហើយរក Makong Coins សម្រាប់ Balance ក្នុងហ្គេម។ បញ្ចូលឈ្មោះ Minecraft តែម្តងគត់ — យើងនឹងចាំវាទុក។",
      "games.unavailableTitle": "មិនអាចប្រើបានទេ",
      "games.unavailableBody":
        "ហ្គេមប្រហែលជានៅក្នុងការជួសជុល ឬបិទជាបណ្តោះអាសន្ន។ សូមមកមើលម្តងទៀតពេលក្រោយ ឬទាក់ទង Support បើនៅតែមានបញ្ហា។",
      "games.coinsUnavailable": "មិនអាចប្រើបានទេ",
      "games.coinBannerText": "⚠️ Coins នឹងមិនចូលទេពេលនេះ — ប្រព័ន្ធ Coins កំពុងមិនដំណើរការ។ សូមទាក់ទង Support សម្រាប់ព័ត៌មានបន្ថែម។",
      "games.start": "ចាប់ផ្តើមលេង",
      "games.disclaimer":
        "ឈ្មោះរបស់អ្នកត្រូវបានរក្សាទុកលើឧបករណ៍នេះ ដូច្នេះបញ្ចូលតែម្តងគត់។ Coins និងពិន្ទុរក្សាទុកនៅលើ Server។",
      "games.playingAs": "កំពុងលេងជា",
      "games.changeName": "ប្តូរឈ្មោះ",
      "games.changeLocked": "ឈ្មោះជាប់សោ · នៅសល់ {time}",
      "games.changeTitle": "ប្តូរឈ្មោះរបស់អ្នក",
      "games.changeHint":
        "ឈ្មោះរបស់អ្នកជាកន្លែងរក្សាទុក Coins និងពិន្ទុ ដូច្នេះអាចប្តូរបានតែម្តងក្នុងមួយថ្ងៃ។",
      "games.changeConfirm": "រក្សាទុកឈ្មោះថ្មី",
      "games.changeCancel": "បោះបង់",
      "games.nameSaved": "ឈ្មោះរបស់អ្នកឥឡូវគឺ {name}។",
      "games.nameLockedToast": "អ្នកអាចប្តូរឈ្មោះម្តងទៀតក្នុងរយៈពេល {time}។",
      "games.welcomeBack": "សូមស្វាគមន៍ការត្រឡប់មកវិញ {name}!",
      "games.points": "ពិន្ទុ",
      "games.pointsSub": "ជុំក្នុងវគ្គនេះ",
      "games.coinsToday": "Coins ថ្ងៃនេះ",
      "games.dailyLimit": "ក្នុងចំណោម {cap} ក្នុងមួយថ្ងៃ",
      "games.resetsIn": "កំណត់ឡើងវិញក្នុង {time}",
      "games.leaderboard": "តារាងពិន្ទុ",
      "games.leaderboardOpen": "បើកតារាងពិន្ទុ",
      "games.leaderboardTitle": "🏆 តារាងពិន្ទុ",
      "games.leaderboardSub": "អ្នកលេង ៥០ នាក់ខ្ពស់បំផុតតាមពិន្ទុសរុប។",
      "games.leaderboardEmpty": "មិនទាន់មានពិន្ទុទេ — លេងមួយជុំ ហើយឈរលេខ ១!",
      "games.leaderboardYou": "អ្នក",
      "games.leaderboardRank": "#",
      "games.leaderboardPlayer": "អ្នកលេង",
      "games.leaderboardPoints": "ពិន្ទុ",
      "games.leaderboardYourRank": "ចំណាត់ថ្នាក់៖ #{rank} · {points} ពិន្ទុ",
      "games.leaderboardUnranked": "លេងមួយជុំដើម្បីចូលក្នុងតារាងពិន្ទុ។",
      "games.listHeading": "ហ្គេមតូចៗ",
      "games.listHint":
        "លេងបាន ៣ ដងក្នុងមួយហ្គេមក្នុងមួយថ្ងៃ, ១–៧៥ Coins ក្នុងមួយដង, រហូតដល់ ១.០០០ Coins ក្នុងមួយថ្ងៃ។ កំណត់ឡើងវិញនៅពាក់កណ្តាលអធ្រាត្រ (UTC+7)។",
      "games.play": "លេង",
      "games.todaysReward": "រង្វាន់ថ្ងៃនេះ៖ {earned} / {cap} Coins",
      "games.dailyComplete": "រង្វាន់ប្រចាំថ្ងៃពេញហើយ!",
      "games.dailyCompleteFull": "រង្វាន់ប្រចាំថ្ងៃពេញហើយ! {cap} / {cap} Coins",
      "games.dailyCompleteNote": "អ្នកអាចបន្តលេងកម្សាន្តបាន ប៉ុន្តែនឹងមិនរក Coins បន្ថែមទៀតថ្ងៃនេះទេ។",
      "games.rewardNote": "រកបានរហូតដល់ <strong>១.០០០ Coins</strong> ក្នុងមួយថ្ងៃពីហ្គេមនេះ។",
      "games.startBtn": "ចាប់ផ្តើម",

      /* ---- games: in-game HUD ---- */
      "hud.points": "ពិន្ទុ",
      "hud.time": "ពេលវេលា",
      "hud.streak": "Streak",
      "hud.lives": "ជីវិត",
      "hud.dodges": "គេចបាន",
      "hud.survived": "រស់បាន",
      "hud.diamonds": "Diamonds",
      "hud.height": "កម្ពស់",
      "hud.ores": "រ៉ែ",
      "hud.toGo": "នៅសល់",
      "hud.deaths": "ធ្លាក់",
      "hud.hearts": "ជីវិត",
      "hud.level": "កម្រិត",

      /* ---- games: the five games ---- */
      "game.lava.name": "Lava Run",
      "game.lava.desc": "ឡើងឲ្យបាន ១០០ម មុនពេល Lava ឡើងមកដល់។ ប្រមូល Diamond តាមផ្លូវ។",
      "game.lava.howto":
        "អូសទៅឆ្វេង-ស្តាំដើម្បីបញ្ជា — តួអង្គលោតដោយស្វ័យប្រវត្តិ។ Diamond +5 · Checkpoint +15 · ដល់គោល +100 បូកមួយពិន្ទុរាល់មួយម៉ែត្រ និងរង្វាន់បន្ថែមបើលឿន។ របារខាងឆ្វេងបង្ហាញគោល ទីតាំងអ្នក និង Lava។",
      "game.lava.hint": "អូសដើម្បីបញ្ជា · 💎 +15 · 🏃 +15 · 🏆 +100",

      "game.breaker.name": "Block Breaker",
      "game.breaker.desc": "ទម្លាយតែ Block ដែលបង្ហាញនៅខាងលើ។ ៤ កម្រិត កម្រិតនីមួយៗ ១០ Block។",
      "game.breaker.howto":
        "ទម្លាយ Block គោលដៅ ១០ ដងដើម្បីឆ្លងកម្រិត។ កម្រិតខ្ពស់ផ្តល់ពិន្ទុច្រើនជាង ហើយឆ្លងគ្រប់ ៤ កម្រិតបានរង្វាន់ពេញ។ Block ខុសកាត់ពេល ១ វិនាទី។",
      "game.breaker.hint": "១០ Block ក្នុងមួយកម្រិត · Block ខុស = -1 វិនាទី",
      "game.breaker.target": "ទម្លាយ",
      "game.breaker.penalty": "-1វិ",

      "game.dodge.name": "Wind Charge Dodge",
      "game.dodge.desc": "គេច Wind Charge ប្រមូល Emerald ហើយរស់ឲ្យបានយូរបំផុត។",
      "game.dodge.howto":
        "អូសដើម្បីផ្លាស់ទី (ឬប្រើគ្រាប់ចុចព្រួញ)។ គេចជិត Wind Charge បាន +2 និង Emerald បាន +5។ ប៉ះម្តងគឺចប់។",
      "game.dodge.hint": "អូសដើម្បីផ្លាស់ទី · គេចជិត +2 · Emerald +5",

      "game.rush.name": "Diamond Rush",
      "game.rush.desc": "៣០ វិនាទីដើម្បីជីករករ៉ែឲ្យបានតម្លៃច្រើនបំផុត។ ចុច TNT ម្តងគឺចប់។",
      "game.rush.howto":
        "Coal +1 · Iron +2 · Gold +4 · Diamond +8 · Emerald +12។ TNT បញ្ចប់ជុំភ្លាម ហើយរ៉ែផ្លាស់ទីកាន់តែញឹកញាប់ — មើលឲ្យច្បាស់មុនចុច។",
      "game.rush.hint": "Coal +1 · Iron +2 · Gold +4 · Diamond +8 · Emerald +12 · TNT = ចប់",
      "game.rush.rubble": "ថ្ម",

      "game.tnt.name": "TNT Escape",
      "game.tnt.desc": "រស់ឲ្យបាន ៤៥ វិនាទីក្នុងទីលានដែលមាន TNT ធ្លាក់។ កុំឈប់ផ្លាស់ទី។",
      "game.tnt.howto":
        "អូសដើម្បីផ្លាស់ទី (ឬប្រើគ្រាប់ចុចព្រួញ)។ TNT នីមួយៗបង្ហាញរង្វង់ផ្ទុះមុនពេលផ្ទុះ — កុំនៅក្នុងវា។ ឈរជិតៗខាងក្រៅបាន +5 ហើយបាន +3 រាល់មួយវិនាទីដែលរស់។",
      "game.tnt.hint": "អូសដើម្បីផ្លាស់ទី · ចេញពីរង្វង់ក្រហម · គេចជិត +5",

      /* ---- games: result screen ---- */
      "result.headline": "លេងបានល្អ!",
      "result.coinsEarned": "Coins ដែលរកបាន",
      "result.playAgain": "លេងម្តងទៀត",
      "result.backToGames": "← ត្រឡប់ទៅហ្គេម",
      "result.saveFailed": "មិនអាចភ្ជាប់ទៅ Server បានទេ ដូច្នេះ Coins វគ្គនេះមិនបានរក្សាទុកឡើយ។",
      "result.height": "កម្ពស់ដែលឡើងបាន",
      "result.diamonds": "Diamonds",
      "result.checkpoints": "Checkpoints",
      "result.runTime": "រយៈពេល",
      "result.outcome": "លទ្ធផល",
      "result.deaths": "ចំនួនធ្លាក់",
      "result.finished": "🏆 ដល់គោលហើយ!",
      "result.perfectRun": "✨ ល្អឥតខ្ចោះ — មិនធ្លាក់សោះ!",
      "result.burned": "🌋 ត្រូវ Lava ចាប់បាន",
      "result.gaveUp": "⏱️ អស់ពេល",
      "result.outOfHearts": "💔 អស់ជីវិត",
      "result.blownUp": "💥 ត្រូវផ្ទុះ",
      "result.survivedAll": "🏆 រស់រហូតដល់ចប់!",
      "result.timeUp": "⏱️ អស់ពេលហើយ",
      "result.allCleared": "🏆 ឆ្លងគ្រប់ ៤ កម្រិត!",
      "result.levelsCleared": "កម្រិតដែលឆ្លងបាន",
      "result.blocksBroken": "Block ដែលទម្លាយបាន",
      "result.wrongBlocks": "Block ខុស",
      "result.timeLost": "ពេលដែលបាត់",
      "result.survived": "រស់បាន",
      "result.dodges": "គេចជិត",
      "result.emeralds": "Emeralds",
      "result.oresMined": "រ៉ែដែលជីកបាន",
      "result.gems": "Diamond និង Emerald",
      "result.bestFind": "រកឃើញល្អបំផុត",

      /* ---- block and ore names stay in English ---- */
      "block.grass": "Grass Block",
      "block.stone": "Stone",
      "block.dirt": "Dirt",
      "block.planks": "Planks",
      "block.gold": "Gold Block",
      "block.diamond": "Diamond",
      "block.redstone": "Redstone",
      "block.lapis": "Lapis",
      "block.emerald": "Emerald",
      "block.obsidian": "Obsidian",
      "block.sand": "Sand",
      "ore.stone": "Stone",
      "ore.coal": "Coal",
      "ore.iron": "Iron",
      "ore.gold": "Gold",
      "ore.diamond": "Diamond",
      "ore.emerald": "Emerald",
      "ore.tnt": "TNT",
    },

    zh: {
      /* ---- nav / chrome ---- */
      "nav.home": "首页",
      "nav.store": "商店",
      "nav.ranking": "排行榜",
      "nav.menu": "菜单",
      "nav.language": "语言",
      "footer.copy": "© {year} Makong Network · 亚洲 Minecraft 服务器 🌏",

      /* ---- home ---- */
      "home.discord": "Discord",
      "home.discordSub": "加入我们的社区",
      "home.copyIp": "点击复制 IP",
      "home.tapJoin": "点击加入 (Bedrock)",
      "home.store": "商店",
      "home.storeSub": "Rank、Keys 等更多内容",
      "home.checking": "正在检查服务器状态…",
      "home.online": "{online} 人在线",
      "home.offline": "服务器离线",
      "home.statusUnavailable": "无法获取状态",
      "home.welcome": "欢迎",
      "home.copied": '已复制 "{ip}" — 粘贴到 Minecraft > Multiplayer > Add Server',
      "home.opening": "正在打开 Minecraft (Bedrock)… Java IP 也已复制备用！",

      /* ---- store ---- */
      "store.subtitle": "商店",
      "store.gamemode": "游戏模式",
      "store.changeRegion": "切换商店",
      "region.title": "选择你的地区",
      "region.subtitle": "这将决定你的支付方式，你可以随时更改。",
      "region.khmer": "柬埔寨",
      "region.khmerDesc": "使用 KHQR 支付",
      "region.global": "Global",
      "region.globalDesc": "通过 Tebex 支付",
      "store.gateTitle": "这是给谁买的？",
      "store.gateHint":
        "请输入一次你的 Minecraft 用户名，方便我们知道发货对象——同时也能显示你目前的 Rank 和 Coins。",
      "store.unavailableTitle": "暂不可用",
      "store.unavailableBody":
        "商店可能正在维护或暂时离线，请稍后再来查看，如果问题持续请联系客服。",
      "store.loggedInAs": "已登录为",
      "store.noRank": "还没有 Rank",
      "store.upgradeNow": "立即升级",
      "store.currentRank": "你目前的 Rank",
      "store.lowerRank": "这是更低的 Rank",
      "store.alreadyOwned": "你已经拥有此项",
      "store.upRank": "升级 Rank",
      "store.upRankChoose": "选择要升级的起始 Rank",
      "store.upgradeSummary": "升级 {from} → {to}",
      "store.upgradeCaption": "你正在将 {from} 升级为 {to}",
      "store.confirmName": "名称",
      "store.confirmPlatform": "平台",
      "store.duration1Month": "1 个月",
      "store.durationPermanent": "永久",
      "store.quantity": "数量",
      "store.qtyDecrease": "减少数量",
      "store.qtyIncrease": "增加数量",
      "store.confirm": "确认",
      "store.cancel": "取消",
      "store.changeHint":
        "这是你购买物品的发货对象，也是保存你网站 Coins 和积分的账户。",
      "store.tab.ranks": "Ranks",
      "store.tab.keys": "Keys",
      "store.tab.other": "其他",
      "store.empty": "这里还没有商品——请稍后再来看看！",
      "store.comingSoon": "即将上线",
      "store.buyNow": "立即购买",
      "store.infoTitle": "物品信息与套装视频",
      "buy.title": "购买：{item}",
      "buy.username": "Minecraft 用户名",
      "buy.edition": "版本",
      "buy.java": "Java",
      "buy.bedrock": "Bedrock",
      "buy.inServerName": "服务器内名称：{name}",
      "buy.continue": "继续",
      "buy.wait": "请稍候…",
      "buy.invalidJava": "请输入有效的 Java 用户名（字母、数字、下划线）。",
      "buy.invalidBedrock": "请输入有效的 Bedrock 玩家名（字母、数字、空格或下划线）。",

      /* ---- checkout ---- */
      "checkout.title": "🌿 完成你的购买 🌿",
      "checkout.loading": "正在加载你的订单…",
      "checkout.inServerName": "服务器内名称",
      "checkout.edition": "版本",
      "checkout.duration": "时长",
      "checkout.total": "总计",
      "checkout.step1": "1. 扫码支付",
      "checkout.scanHint": "使用任意柬埔寨银行 App 扫描此 KHQR，并支付 {amount}。",
      "checkout.saveKhqr": "💾 保存 KHQR",
      "checkout.saveHint": "保存后，从你银行 App 的相册中扫描。",
      "checkout.step2": "2. 上传付款截图",
      "checkout.uploadHint": "付款后，请附上交易凭证截图以便我们核实。",
      "checkout.dropText": "点击选择截图，或将文件拖到此处",
      "checkout.submit": "提交",
      "checkout.submitNote": "请附上收据以启用提交。",
      "checkout.ready": "已准备好提交。",
      "checkout.submitting": "正在提交…",
      "checkout.sending": "正在发送你的收据…",
      "checkout.retry": "出了点问题——请重试。",
      "checkout.trouble": "遇到问题了吗？",
      "checkout.contactSupport": "通过 Telegram 联系客服",
      "checkout.notImage": "请选择图片文件（付款收据截图）。",
      "checkout.tooBig": "图片大于 8 MB——请使用更小的截图。",
      "checkout.noOrder": "未指定订单。",
      "checkout.backToStore": "返回商店",
      "checkout.loadFailed": "无法加载该订单（{error}）。",
      "checkout.khqrMissing": "尚未上传 KHQR 图片——请添加到 public/images/site/khqr.png",
      "checkout.orTebex": "或立即支付",
      "checkout.tebexHint": "通过 Tebex 安全结账页面使用信用卡或 Tebex Wallet 支付——自动确认，无需截图。",
      "checkout.payTebex": "使用 Tebex 支付",
      "checkout.tebexVerifying": "正在确认你的 Tebex 付款…",
      "checkout.tebexNotPaid": "我们尚未收到你的付款。如果你已完成结账，请稍等片刻再试一次。",
      "checkout.tebexCheckAgain": "再次检查",
      "checkout.tebexFailed": "无法启动 Tebex 结账——请重试，或使用下方 KHQR 支付。",
      "checkout.tebexError": "确认你的 Tebex 付款时出现问题（{error}）。",

      /* ---- success ---- */
      "success.title": "提交成功！",
      "success.body":
        "谢谢！你的付款凭证已发送给管理员审核。请等待确认——你的物品通常会在几分钟内送达游戏内。",
      "success.item": "物品",
      "success.amount": "金额",
      "success.orderId": "订单编号",
      "success.supportLine": "一小时后仍未收到物品？请联系客服。",
      "success.supportLineLink": "一小时后仍未收到物品？",
      "success.back": "返回首页",

      /* ---- ranking ---- */
      "ranking.subtitle": "排行榜",
      "ranking.tab.teams": "最佳战队",
      "ranking.tab.players": "最佳玩家",
      "ranking.stat.star": "星级",
      "ranking.empty": "还没有排行数据——请稍后再来看看！",
      "ranking.loading": "正在加载排行榜…",
      "ranking.source.live": "🟢 服务器实时数据",
      "ranking.source.sample": "示例排行榜",

      /* ---- games: gate + hub ---- */
      "games.subtitle": "游戏",
      "games.verify": "验证",
      "games.coins": "Coins",
      "games.topPoints": "最高积分",
      "games.viewFull": "查看全部",
      "games.earnedToday": "今日已获得 {earned}/{cap}",
      "games.playsLeft": "今日剩余 {left}/{cap} 次",
      "games.noPlaysLeft": "今日次数已用完",
      "games.noPlaysLeftToast": "你今天已经玩了 3 次这个游戏，请在重置后再来。",
      "games.cannotStart": "无法开始本局",
      "games.go": "开始！",

      "games.gateTitle": "边玩边赚 Coins",
      "games.gateHint":
        "直接在本网站上玩小游戏，赚取 Makong Coins 存入你的游戏内余额。只需输入一次你的 Minecraft 名称——我们会帮你记住。",
      "games.unavailableTitle": "暂不可用",
      "games.unavailableBody":
        "游戏可能正在维护或暂时离线，请稍后再来查看，如果问题持续请联系客服。",
      "games.coinsUnavailable": "暂不可用",
      "games.coinBannerText": "⚠️ 目前无法获得 Coins——Coins 系统暂不可用。如需了解详情请联系客服。",
      "games.start": "开始游戏",
      "games.disclaimer":
        "你的名称会保存在此设备上，因此只需输入一次。Coins 和积分保存在服务器上。",
      "games.playingAs": "当前游戏身份",
      "games.changeName": "更改名称",
      "games.changeLocked": "名称已锁定 · 剩余 {time}",
      "games.changeTitle": "更改你的名称",
      "games.changeHint":
        "你的名称是保存 Coins 和积分的依据，因此每天只能更改一次。",
      "games.changeConfirm": "保存新名称",
      "games.changeCancel": "取消",
      "games.nameSaved": "你的名称现在是 {name}。",
      "games.nameLockedToast": "你可以在 {time} 后再次更改名称。",
      "games.welcomeBack": "欢迎回来，{name}！",
      "games.points": "积分",
      "games.pointsSub": "本次会话局数",
      "games.coinsToday": "今日 Coins",
      "games.dailyLimit": "每日上限 {cap}",
      "games.resetsIn": "{time} 后重置",
      "games.leaderboard": "积分排行榜",
      "games.leaderboardOpen": "打开排行榜",
      "games.leaderboardTitle": "🏆 积分排行榜",
      "games.leaderboardSub": "按累计积分排名的前 50 位玩家。",
      "games.leaderboardEmpty": "还没有分数——玩一局，抢占第一！",
      "games.leaderboardYou": "你",
      "games.leaderboardRank": "#",
      "games.leaderboardPlayer": "玩家",
      "games.leaderboardPoints": "积分",
      "games.leaderboardYourRank": "你的排名：#{rank} · {points} 分",
      "games.leaderboardUnranked": "玩一局即可进入排行榜。",
      "games.listHeading": "小游戏",
      "games.listHint":
        "每个游戏每天可玩 3 次，每次 1–75 Coins，每日总计最多 1,000 Coins。每天午夜（UTC+7）重置。",
      "games.play": "开始",
      "games.todaysReward": "今日奖励：{earned} / {cap} Coins",
      "games.dailyComplete": "今日奖励已达上限！",
      "games.dailyCompleteFull": "今日奖励已达上限！{cap} / {cap} Coins",
      "games.dailyCompleteNote": "你仍可以继续游玩娱乐，但今天不会再获得更多 Coins。",
      "games.rewardNote": "本游戏每天最多可赚取 <strong>1,000 Coins</strong>。",
      "games.startBtn": "开始",

      /* ---- games: in-game HUD ---- */
      "hud.points": "积分",
      "hud.time": "时间",
      "hud.streak": "连击",
      "hud.lives": "生命",
      "hud.dodges": "闪避",
      "hud.survived": "存活",
      "hud.diamonds": "Diamonds",
      "hud.height": "高度",
      "hud.ores": "矿石",
      "hud.toGo": "剩余",
      "hud.deaths": "跌落次数",
      "hud.hearts": "生命值",
      "hud.level": "等级",

      /* ---- games: the five games ---- */
      "game.lava.name": "Lava Run",
      "game.lava.desc": "在熔岩追上你之前爬升 100 米。途中收集 Diamond。",
      "game.lava.howto":
        "左右拖动来控制方向——角色会自动跳跃。Diamond +5 · Checkpoint +15 · 到达终点 +100，另外每爬升一米加一分，速度快还有额外奖励。左侧轨道显示终点、你的位置和熔岩。",
      "game.lava.hint": "拖动控制方向 · 💎 +15 · 🏃 +15 · 🏆 +100",

      "game.breaker.name": "Block Breaker",
      "game.breaker.desc": "只破坏顶部显示的方块。共 4 个关卡，每关 10 个方块，网格会不断变大。",
      "game.breaker.howto":
        "破坏 10 个目标方块即可通关。关卡越高分数越多，全部通关四关可获得最高奖励。破坏错误方块会扣 1 秒。",
      "game.breaker.hint": "每关 10 个方块 · 破坏错误 = -1 秒",
      "game.breaker.target": "破坏",
      "game.breaker.penalty": "-1秒",

      "game.dodge.name": "Wind Charge Dodge",
      "game.dodge.desc": "躲避 Wind Charge，收集 Emerald，尽可能存活更久。",
      "game.dodge.howto":
        "拖动移动（或使用方向键）。擦身躲过 Wind Charge 得 +2，Emerald +5。被击中一次即结束。",
      "game.dodge.hint": "拖动移动 · 贴身闪避 +2 · Emerald +5",

      "game.rush.name": "Diamond Rush",
      "game.rush.desc": "30 秒内尽可能挖出更多价值。碰到 TNT 一次即结束。",
      "game.rush.howto":
        "Coal +1 · Iron +2 · Gold +4 · Diamond +8 · Emerald +12。TNT 会立即结束本局，矿脉会越来越快地重新排列——出手前先看清楚。",
      "game.rush.hint": "Coal +1 · Iron +2 · Gold +4 · Diamond +8 · Emerald +12 · TNT = 结束",
      "game.rush.rubble": "碎石",

      "game.tnt.name": "TNT Escape",
      "game.tnt.desc": "在不断落下 TNT 的场地中存活 45 秒。保持移动。",
      "game.tnt.howto":
        "拖动移动（或使用方向键）。每个 TNT 爆炸前会显示范围圈——远离它。刚好站在圈外可得 +5，每存活一秒再得 +3。",
      "game.tnt.hint": "拖动移动 · 远离红色区域 · 贴身闪避 +5",

      /* ---- games: result screen ---- */
      "result.headline": "干得漂亮！",
      "result.coinsEarned": "获得 Coins",
      "result.playAgain": "再玩一次",
      "result.backToGames": "← 返回游戏",
      "result.saveFailed": "无法连接服务器，本局 Coins 未能保存。",
      "result.height": "攀爬高度",
      "result.diamonds": "Diamonds",
      "result.checkpoints": "Checkpoints",
      "result.runTime": "用时",
      "result.outcome": "结果",
      "result.deaths": "跌落次数",
      "result.finished": "🏆 到达终点！",
      "result.perfectRun": "✨ 完美通关——全程未跌落！",
      "result.burned": "🌋 被熔岩吞没",
      "result.gaveUp": "⏱️ 时间耗尽",
      "result.outOfHearts": "💔 生命耗尽",
      "result.blownUp": "💥 被炸飞",
      "result.survivedAll": "🏆 坚持到最后！",
      "result.timeUp": "⏱️ 时间到",
      "result.allCleared": "🏆 四个关卡全部通关！",
      "result.levelsCleared": "已通关关卡",
      "result.blocksBroken": "已破坏方块",
      "result.wrongBlocks": "破坏错误",
      "result.timeLost": "损失时间",
      "result.survived": "存活时间",
      "result.dodges": "贴身闪避",
      "result.emeralds": "Emeralds",
      "result.oresMined": "已挖矿石",
      "result.gems": "Diamonds 与 Emeralds",
      "result.bestFind": "最佳收获",

      /* ---- block and ore names stay in English ---- */
      "block.grass": "Grass Block",
      "block.stone": "Stone",
      "block.dirt": "Dirt",
      "block.planks": "Planks",
      "block.gold": "Gold Block",
      "block.diamond": "Diamond",
      "block.redstone": "Redstone",
      "block.lapis": "Lapis",
      "block.emerald": "Emerald",
      "block.obsidian": "Obsidian",
      "block.sand": "Sand",
      "ore.stone": "Stone",
      "ore.coal": "Coal",
      "ore.iron": "Iron",
      "ore.gold": "Gold",
      "ore.diamond": "Diamond",
      "ore.emerald": "Emerald",
      "ore.tnt": "TNT",
    },

    vi: {
      /* ---- nav / chrome ---- */
      "nav.home": "Trang chủ",
      "nav.store": "Cửa hàng",
      "nav.ranking": "Bảng xếp hạng",
      "nav.menu": "Menu",
      "nav.language": "Ngôn ngữ",
      "footer.copy": "© {year} Makong Network · Máy chủ Minecraft Châu Á 🌏",

      /* ---- home ---- */
      "home.discord": "Discord",
      "home.discordSub": "Tham gia cộng đồng của chúng tôi",
      "home.copyIp": "Nhấn để sao chép IP",
      "home.tapJoin": "Chạm để tham gia (Bedrock)",
      "home.store": "Cửa hàng",
      "home.storeSub": "Rank, Keys và nhiều hơn nữa",
      "home.checking": "Đang kiểm tra trạng thái server…",
      "home.online": "{online} người chơi",
      "home.offline": "Server ngoại tuyến",
      "home.statusUnavailable": "Không thể lấy trạng thái",
      "home.welcome": "Chào mừng",
      "home.copied": 'Đã sao chép "{ip}" — dán vào Minecraft > Multiplayer > Add Server',
      "home.opening": "Đang mở Minecraft (Bedrock)… IP Java cũng đã được sao chép để dự phòng!",

      /* ---- store ---- */
      "store.subtitle": "CỬA HÀNG",
      "store.gamemode": "Chế độ chơi",
      "store.changeRegion": "Đổi khu vực cửa hàng",
      "region.title": "Chọn khu vực của bạn",
      "region.subtitle": "Điều này quyết định cách bạn thanh toán. Bạn có thể thay đổi bất cứ lúc nào.",
      "region.khmer": "Campuchia",
      "region.khmerDesc": "Thanh toán bằng KHQR",
      "region.global": "Global",
      "region.globalDesc": "Thanh toán qua Tebex",
      "store.gateTitle": "Mua cho ai?",
      "store.gateHint":
        "Nhập tên Minecraft của bạn một lần để chúng tôi biết giao hàng cho ai — và để hiển thị Rank cùng Coins hiện tại của bạn.",
      "store.unavailableTitle": "Không khả dụng",
      "store.unavailableBody":
        "Cửa hàng có thể đang bảo trì hoặc tạm ngoại tuyến. Vui lòng quay lại sau, hoặc liên hệ hỗ trợ nếu tình trạng này tiếp diễn.",
      "store.loggedInAs": "Đã đăng nhập với tên",
      "store.noRank": "Chưa có Rank",
      "store.upgradeNow": "Nâng cấp ngay",
      "store.currentRank": "Rank hiện tại của bạn",
      "store.lowerRank": "Đây là Rank thấp hơn",
      "store.alreadyOwned": "Bạn đã sở hữu mục này",
      "store.upRank": "Nâng Rank",
      "store.upRankChoose": "Chọn Rank để nâng cấp từ",
      "store.upgradeSummary": "Nâng cấp {from} → {to}",
      "store.upgradeCaption": "Bạn đang nâng cấp {from} lên {to}",
      "store.confirmName": "Tên",
      "store.confirmPlatform": "Nền tảng",
      "store.duration1Month": "1 Tháng",
      "store.durationPermanent": "Vĩnh viễn",
      "store.quantity": "Số lượng",
      "store.qtyDecrease": "Giảm số lượng",
      "store.qtyIncrease": "Tăng số lượng",
      "store.confirm": "Xác nhận",
      "store.cancel": "Hủy",
      "store.changeHint":
        "Đây là tên nhận các vật phẩm bạn mua, và cũng là tài khoản lưu Coins cùng điểm trên website của bạn.",
      "store.tab.ranks": "Ranks",
      "store.tab.keys": "Keys",
      "store.tab.other": "Khác",
      "store.empty": "Chưa có vật phẩm nào ở đây — hãy quay lại sau nhé!",
      "store.comingSoon": "Sắp ra mắt",
      "store.buyNow": "Mua ngay",
      "store.infoTitle": "Thông tin vật phẩm & video kit",
      "buy.title": "Mua: {item}",
      "buy.username": "Tên người dùng Minecraft",
      "buy.edition": "Phiên bản",
      "buy.java": "Java",
      "buy.bedrock": "Bedrock",
      "buy.inServerName": "Tên trong server: {name}",
      "buy.continue": "Tiếp tục",
      "buy.wait": "Vui lòng chờ…",
      "buy.invalidJava": "Nhập tên Java hợp lệ (chữ cái, số, dấu gạch dưới).",
      "buy.invalidBedrock": "Nhập gamertag Bedrock hợp lệ (chữ cái, số, khoảng trắng hoặc dấu gạch dưới).",

      /* ---- checkout ---- */
      "checkout.title": "🌿 Hoàn tất đơn mua của bạn 🌿",
      "checkout.loading": "Đang tải đơn hàng của bạn…",
      "checkout.inServerName": "Tên trong server",
      "checkout.edition": "Phiên bản",
      "checkout.duration": "Thời hạn",
      "checkout.total": "Tổng cộng",
      "checkout.step1": "1. Quét mã để thanh toán",
      "checkout.scanHint": "Quét mã KHQR này bằng bất kỳ ứng dụng ngân hàng Campuchia nào và thanh toán đúng {amount}.",
      "checkout.saveKhqr": "💾 Lưu KHQR",
      "checkout.saveHint": "Lưu lại, sau đó quét từ thư viện ảnh trong ứng dụng ngân hàng của bạn.",
      "checkout.step2": "2. Tải lên ảnh chụp màn hình thanh toán",
      "checkout.uploadHint": "Sau khi thanh toán, đính kèm ảnh chụp màn hình biên lai giao dịch để chúng tôi xác minh.",
      "checkout.dropText": "Chạm để chọn ảnh chụp màn hình, hoặc kéo thả vào đây",
      "checkout.submit": "GỬI",
      "checkout.submitNote": "Đính kèm biên lai để bật nút Gửi.",
      "checkout.ready": "Sẵn sàng để gửi.",
      "checkout.submitting": "Đang gửi…",
      "checkout.sending": "Đang gửi biên lai của bạn…",
      "checkout.retry": "Có lỗi xảy ra — vui lòng thử lại.",
      "checkout.trouble": "Gặp sự cố?",
      "checkout.contactSupport": "Liên hệ hỗ trợ qua Telegram",
      "checkout.notImage": "Vui lòng chọn một tệp hình ảnh (ảnh chụp màn hình biên lai của bạn).",
      "checkout.tooBig": "Hình ảnh này lớn hơn 8 MB — vui lòng dùng ảnh nhỏ hơn.",
      "checkout.noOrder": "Không có đơn hàng nào được chỉ định.",
      "checkout.backToStore": "Quay lại cửa hàng",
      "checkout.loadFailed": "Không thể tải đơn hàng đó ({error}).",
      "checkout.khqrMissing": "Chưa tải lên ảnh KHQR — thêm vào public/images/site/khqr.png",
      "checkout.orTebex": "Hoặc thanh toán ngay",
      "checkout.tebexHint":
        "Thanh toán bằng thẻ hoặc Tebex Wallet qua trang thanh toán bảo mật của Tebex — được xác nhận tự động, không cần ảnh chụp màn hình.",
      "checkout.payTebex": "Thanh toán qua Tebex",
      "checkout.tebexVerifying": "Đang xác nhận thanh toán Tebex của bạn…",
      "checkout.tebexNotPaid": "Chúng tôi chưa nhận được thanh toán của bạn. Nếu bạn đã hoàn tất thanh toán, hãy đợi một chút rồi thử lại.",
      "checkout.tebexCheckAgain": "Kiểm tra lại",
      "checkout.tebexFailed": "Không thể bắt đầu thanh toán Tebex — vui lòng thử lại hoặc thanh toán bằng KHQR bên dưới.",
      "checkout.tebexError": "Có lỗi khi xác nhận thanh toán Tebex của bạn ({error}).",

      /* ---- success ---- */
      "success.title": "Gửi thành công!",
      "success.body":
        "Cảm ơn bạn! Biên lai thanh toán của bạn đã được gửi cho quản trị viên để xem xét. Vui lòng chờ xác nhận — vật phẩm của bạn thường được giao trong game sau vài phút.",
      "success.item": "Vật phẩm",
      "success.amount": "Số tiền",
      "success.orderId": "Mã đơn hàng",
      "success.supportLine": "Sau một giờ vẫn chưa nhận được vật phẩm? Vui lòng liên hệ hỗ trợ.",
      "success.supportLineLink": "Sau một giờ vẫn chưa nhận được vật phẩm?",
      "success.back": "Về trang chủ",

      /* ---- ranking ---- */
      "ranking.subtitle": "BẢNG XẾP HẠNG",
      "ranking.tab.teams": "Đội xuất sắc",
      "ranking.tab.players": "Người chơi xuất sắc",
      "ranking.stat.star": "Sao",
      "ranking.empty": "Chưa có bảng xếp hạng — hãy quay lại sau nhé!",
      "ranking.loading": "Đang tải bảng xếp hạng…",
      "ranking.source.live": "🟢 Trực tiếp từ máy chủ",
      "ranking.source.sample": "Bảng xếp hạng mẫu",

      /* ---- games: gate + hub ---- */
      "games.subtitle": "TRÒ CHƠI",
      "games.verify": "Xác minh",
      "games.coins": "Coins",
      "games.topPoints": "Điểm cao nhất",
      "games.viewFull": "Xem toàn bộ",
      "games.earnedToday": "đã kiếm {earned}/{cap} hôm nay",
      "games.playsLeft": "còn {left} trong {cap} lượt hôm nay",
      "games.noPlaysLeft": "Hết lượt chơi hôm nay",
      "games.noPlaysLeftToast": "Bạn đã dùng hết 3 lượt chơi game này hôm nay. Hãy quay lại sau khi được đặt lại.",
      "games.cannotStart": "Không thể bắt đầu lượt này",
      "games.go": "BẮT ĐẦU!",

      "games.gateTitle": "Chơi & kiếm Coins",
      "games.gateHint":
        "Chơi các trò chơi nhỏ ngay trên website này và kiếm Makong Coins cho số dư trong game của bạn. Nhập tên Minecraft một lần — chúng tôi sẽ ghi nhớ cho lần sau.",
      "games.unavailableTitle": "Không khả dụng",
      "games.unavailableBody":
        "Trò chơi có thể đang bảo trì hoặc tạm ngoại tuyến. Vui lòng quay lại sau, hoặc liên hệ hỗ trợ nếu tình trạng này tiếp diễn.",
      "games.coinsUnavailable": "Không khả dụng",
      "games.coinBannerText": "⚠️ Hiện chưa thể nhận Coins — hệ thống Coins đang không khả dụng. Liên hệ hỗ trợ để biết thêm chi tiết.",
      "games.start": "Bắt đầu chơi",
      "games.disclaimer":
        "Tên của bạn được lưu trên thiết bị này, nên bạn chỉ cần nhập một lần. Coins và điểm được lưu trên server.",
      "games.playingAs": "Đang chơi với tên",
      "games.changeName": "Đổi tên",
      "games.changeLocked": "Tên đang khóa · còn {time}",
      "games.changeTitle": "Đổi tên của bạn",
      "games.changeHint":
        "Tên của bạn là nơi lưu Coins và điểm, nên chỉ có thể đổi một lần mỗi ngày.",
      "games.changeConfirm": "Lưu tên mới",
      "games.changeCancel": "Hủy",
      "games.nameSaved": "Tên của bạn bây giờ là {name}.",
      "games.nameLockedToast": "Bạn có thể đổi tên lại sau {time}.",
      "games.welcomeBack": "Chào mừng trở lại, {name}!",
      "games.points": "Điểm",
      "games.pointsSub": "Lượt chơi trong phiên này",
      "games.coinsToday": "Coins hôm nay",
      "games.dailyLimit": "trong giới hạn {cap} mỗi ngày",
      "games.resetsIn": "Đặt lại sau {time}",
      "games.leaderboard": "Bảng xếp hạng điểm",
      "games.leaderboardOpen": "Mở bảng xếp hạng",
      "games.leaderboardTitle": "🏆 Bảng xếp hạng điểm",
      "games.leaderboardSub": "Top 50 người chơi theo tổng điểm.",
      "games.leaderboardEmpty": "Chưa có điểm nào — chơi một lượt và giành vị trí đầu tiên!",
      "games.leaderboardYou": "Bạn",
      "games.leaderboardRank": "#",
      "games.leaderboardPlayer": "Người chơi",
      "games.leaderboardPoints": "Điểm",
      "games.leaderboardYourRank": "Hạng của bạn: #{rank} · {points} điểm",
      "games.leaderboardUnranked": "Chơi một lượt để vào bảng xếp hạng.",
      "games.listHeading": "Trò chơi nhỏ",
      "games.listHint":
        "3 lượt chơi mỗi game mỗi ngày, 1–75 Coins mỗi lượt, tối đa 1.000 Coins mỗi ngày. Đặt lại vào nửa đêm (UTC+7).",
      "games.play": "Chơi",
      "games.todaysReward": "Thưởng hôm nay: {earned} / {cap} Coins",
      "games.dailyComplete": "Đã đạt thưởng tối đa hôm nay!",
      "games.dailyCompleteFull": "Đã đạt thưởng tối đa hôm nay! {cap} / {cap} Coins",
      "games.dailyCompleteNote": "Bạn vẫn có thể tiếp tục chơi cho vui, nhưng sẽ không kiếm thêm Coins hôm nay.",
      "games.rewardNote": "Kiếm tối đa <strong>1.000 Coins</strong> mỗi ngày từ trò chơi này.",
      "games.startBtn": "Bắt đầu",

      /* ---- games: in-game HUD ---- */
      "hud.points": "Điểm",
      "hud.time": "Thời gian",
      "hud.streak": "Chuỗi",
      "hud.lives": "Mạng",
      "hud.dodges": "Né tránh",
      "hud.survived": "Sống sót",
      "hud.diamonds": "Diamonds",
      "hud.height": "Độ cao",
      "hud.ores": "Quặng",
      "hud.toGo": "Còn lại",
      "hud.deaths": "Số lần ngã",
      "hud.hearts": "Tim",
      "hud.level": "Cấp độ",

      /* ---- games: the five games ---- */
      "game.lava.name": "Lava Run",
      "game.lava.desc": "Leo lên 100m trước khi dung nham dâng lên bắt kịp bạn. Nhặt Diamond trên đường đi.",
      "game.lava.howto":
        "Kéo trái phải để điều khiển — nhân vật tự động nảy. Diamond +5 · Checkpoint +15 · Về đích +100, cộng thêm một điểm mỗi mét leo được và thưởng thêm nếu về đích nhanh. Thanh bên trái hiển thị đích, vị trí bạn và dung nham.",
      "game.lava.hint": "Kéo để điều khiển · 💎 +15 · 🏃 +15 · 🏆 +100",

      "game.breaker.name": "Block Breaker",
      "game.breaker.desc": "Chỉ phá khối được hiển thị ở trên cùng. Bốn cấp độ, mỗi cấp mười khối, và lưới ngày càng lớn hơn.",
      "game.breaker.howto":
        "Phá mười khối mục tiêu để qua cấp. Cấp sau có giá trị cao hơn, và vượt qua cả bốn cấp sẽ nhận thưởng tối đa. Phá nhầm khối sẽ bị trừ một giây.",
      "game.breaker.hint": "10 khối mỗi cấp · Phá nhầm = -1 giây",
      "game.breaker.target": "PHÁ",
      "game.breaker.penalty": "-1s",

      "game.dodge.name": "Wind Charge Dodge",
      "game.dodge.desc": "Né tránh Wind Charge, nhặt Emerald, sống sót càng lâu càng tốt.",
      "game.dodge.howto":
        "Kéo để di chuyển (hoặc dùng phím mũi tên). Né sát Wind Charge được +2, Emerald +5. Trúng một lần là kết thúc.",
      "game.dodge.hint": "Kéo để di chuyển · Né sát +2 · Emerald +5",

      "game.rush.name": "Diamond Rush",
      "game.rush.desc": "Ba mươi giây để đào được càng nhiều giá trị càng tốt. Chạm vào TNT một lần là kết thúc.",
      "game.rush.howto":
        "Coal +1 · Iron +2 · Gold +4 · Diamond +8 · Emerald +12. TNT kết thúc lượt chơi ngay lập tức, và vỉa khoáng sẽ xáo trộn ngày càng nhanh — hãy nhìn kỹ trước khi đào.",
      "game.rush.hint": "Coal +1 · Iron +2 · Gold +4 · Diamond +8 · Emerald +12 · TNT = kết thúc",
      "game.rush.rubble": "Đá vụn",

      "game.tnt.name": "TNT Escape",
      "game.tnt.desc": "Sống sót 45 giây trong một đấu trường mưa TNT. Luôn di chuyển.",
      "game.tnt.howto":
        "Kéo để di chuyển (hoặc dùng phím mũi tên). Mỗi quả TNT hiện vòng tròn nổ trước khi phát nổ — tránh xa nó. Đứng vừa ngoài vòng tròn được +5, và bạn được +3 cho mỗi giây còn sống.",
      "game.tnt.hint": "Kéo để di chuyển · Tránh xa vùng đỏ · Né sát +5",

      /* ---- games: result screen ---- */
      "result.headline": "Chơi tốt lắm!",
      "result.coinsEarned": "Coins kiếm được",
      "result.playAgain": "Chơi lại",
      "result.backToGames": "← Quay lại trò chơi",
      "result.saveFailed": "Không thể kết nối tới server, nên Coins của lượt này chưa được lưu.",
      "result.height": "Độ cao đã leo",
      "result.diamonds": "Diamonds",
      "result.checkpoints": "Checkpoints",
      "result.runTime": "Thời gian",
      "result.outcome": "Kết quả",
      "result.deaths": "Số lần ngã",
      "result.finished": "🏆 Đã về đích!",
      "result.perfectRun": "✨ Hoàn hảo — không ngã lần nào!",
      "result.burned": "🌋 Bị dung nham nhấn chìm",
      "result.gaveUp": "⏱️ Hết giờ",
      "result.outOfHearts": "💔 Hết mạng",
      "result.blownUp": "💥 Bị nổ tung",
      "result.survivedAll": "🏆 Sống sót đến cùng!",
      "result.timeUp": "⏱️ Hết giờ",
      "result.allCleared": "🏆 Đã vượt qua cả bốn cấp độ!",
      "result.levelsCleared": "Cấp độ đã vượt qua",
      "result.blocksBroken": "Khối đã phá",
      "result.wrongBlocks": "Khối phá nhầm",
      "result.timeLost": "Thời gian đã mất",
      "result.survived": "Thời gian sống sót",
      "result.dodges": "Lượt né sát",
      "result.emeralds": "Emeralds",
      "result.oresMined": "Quặng đã đào",
      "result.gems": "Diamonds & Emeralds",
      "result.bestFind": "Thành quả tốt nhất",

      /* ---- block and ore names stay in English ---- */
      "block.grass": "Grass Block",
      "block.stone": "Stone",
      "block.dirt": "Dirt",
      "block.planks": "Planks",
      "block.gold": "Gold Block",
      "block.diamond": "Diamond",
      "block.redstone": "Redstone",
      "block.lapis": "Lapis",
      "block.emerald": "Emerald",
      "block.obsidian": "Obsidian",
      "block.sand": "Sand",
      "ore.stone": "Stone",
      "ore.coal": "Coal",
      "ore.iron": "Iron",
      "ore.gold": "Gold",
      "ore.diamond": "Diamond",
      "ore.emerald": "Emerald",
      "ore.tnt": "TNT",
    },
  };

  const LANGS = ["en", "km", "zh", "vi"];

  function stored() {
    try {
      const value = localStorage.getItem(LANG_KEY);
      return LANGS.includes(value) ? value : null;
    } catch {
      return null;
    }
  }

  let lang = stored() || "en"; // English is the default, as asked

  function translate(key, vars) {
    const table = DICT[lang] || DICT.en;
    let text = table[key];
    if (text == null) text = DICT.en[key];
    if (text == null) return key;
    // {year} is always available so the footer needs no wiring.
    const merged = Object.assign({ year: new Date().getFullYear() }, vars || {});
    for (const [name, value] of Object.entries(merged)) {
      text = text.split(`{${name}}`).join(String(value));
    }
    return text;
  }

  /* Money. Khmer readers get the riel equivalent alongside the dollar
     amount (1 USD = 4,000 riel) — the amount actually charged is still USD. */
  function formatUsd(amount) {
    return `$${Number(amount || 0).toFixed(2)}`;
  }
  function formatRiel(amount) {
    return `${Math.round(Number(amount || 0) * RIEL_PER_USD).toLocaleString("en-US")}៛`;
  }
  function formatPrice(amount) {
    return lang === "km" ? formatRiel(amount) : formatUsd(amount);
  }

  // Swap every marked string in `root` (defaults to the whole document).
  function apply(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = translate(node.dataset.i18n, readVars(node));
    });
    scope.querySelectorAll("[data-i18n-html]").forEach((node) => {
      node.innerHTML = translate(node.dataset.i18nHtml, readVars(node));
    });
    ["placeholder", "title", "aria-label"].forEach((attr) => {
      const dataAttr = `data-i18n-${attr === "aria-label" ? "aria" : attr}`;
      scope.querySelectorAll(`[${dataAttr}]`).forEach((node) => {
        node.setAttribute(attr, translate(node.getAttribute(dataAttr), readVars(node)));
      });
    });
    if (scope === document) document.documentElement.lang = lang;
  }

  // data-i18n-vars='{"year":"2026"}' for strings with placeholders in markup.
  function readVars(node) {
    const raw = node.getAttribute("data-i18n-vars");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function syncButtons() {
    document.querySelectorAll(".lang-toggle").forEach((btn) => {
      btn.setAttribute("aria-label", translate("nav.language"));
    });
    document.querySelectorAll(".lang-current").forEach((span) => {
      span.textContent = { en: "EN", km: "KH", zh: "ZH", vi: "VI" }[lang] || "EN";
    });
    document.querySelectorAll(".lang-option").forEach((opt) => {
      opt.classList.toggle("active", opt.dataset.lang === lang);
    });
  }

  function set(next) {
    lang = LANGS.includes(next) ? next : "en";
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* private browsing - the choice just won't persist */
    }
    apply();
    syncButtons();
    // Picking a language from the dropdown should close it, same as a nav link.
    document.querySelector(".lang-menu")?.classList.remove("open");
    document.querySelector(".lang-toggle")?.setAttribute("aria-expanded", "false");
    document.dispatchEvent(new CustomEvent("i18n:change", { detail: { lang } }));
  }

  function toggle() {
    set(LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]);
  }

  document.addEventListener("DOMContentLoaded", () => {
    apply();
    syncButtons();
  });

  return {
    t: translate,
    apply,
    set,
    toggle,
    formatPrice,
    formatUsd,
    formatRiel,
    RIEL_PER_USD,
    get lang() {
      return lang;
    },
  };
})();

// Short global aliases so page scripts stay readable.
const t = I18n.t;
const formatPrice = I18n.formatPrice;
function setLang(next) {
  I18n.set(next);
}
