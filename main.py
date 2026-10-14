from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai import types
import os
import uvicorn
import copy
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini
# Load environment variables from .env if present
if os.path.exists(".env"):
    try:
        with open(".env", "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip().strip('"').strip("'")
    except Exception as e:
        print(f"Warning: Could not read .env file: {e}")

api_key = (os.environ.get("GEMINI_API_KEY") or "").strip().strip('"').strip("'")

# System prompt to give KAKASHI its personality
KAKASHI_PROMPT = """You are KAKASHI, a friendly, supportive, and highly knowledgeable Japanese Sensei (tutor) and mentor. 
You are chatting with a student learning Japanese (levels JLPT N5 to N2). 
Always be encouraging, use emojis, and talk like a supportive Sensei.
When explaining Japanese concepts (grammar, kanji, vocab, particles), be incredibly clear, use simple English, and provide practical examples.
You have comprehensive knowledge of JLPT N5, N4, N3, and N2 levels (including grammar patterns, vocabulary, kanji, hiragana, katakana, and particles).
You are robust to informal greeting variations (like "hlo", "hlw", "hy", "hye", "hello") and will greet the user warmly as a student of Japanese.
Never break character. You are KAKASHI Sensei."""

# Keep a simple memory in memory (for a single user for now)
client = None
chat_session = None
init_error = None

if api_key:
    try:
        client = genai.Client(api_key=api_key)
        model_name = (os.environ.get("GEMINI_MODEL") or "gemini-2.5-flash").strip().strip('"').strip("'")
        chat_session = client.chats.create(
            model=model_name,
            config=types.GenerateContentConfig(
                system_instruction=KAKASHI_PROMPT,
            )
        )
    except Exception as e:
        init_error = str(e)
        print(f"Error initializing Gemini client: {e}")
else:
    init_error = "GEMINI_API_KEY environment variable is missing."

@app.post("/chat")
async def chat(request: Request):
    global client, chat_session, init_error
    data = await request.json()
    user_message = data.get("message", "")
    
    if not client or not chat_session:
        error_details = init_error if init_error else "API key is not configured."
        return {
            "response": "Oh no! 🥷 **Kakashi is out of chakra right now, its restoring its chakra so pls wait.**\n\n"
                        f"*(Details: `{error_details}`)*\n\n"
                        "But don't worry! You can still use my offline features:\n"
                        "* Type **`quiz`** to test your knowledge.\n"
                        "* Ask about grammar particles like **`wa vs ga`** or **`ni vs de`**.\n"
                        "* Type **`correct: [your sentence]`** to practice writing.\n\n"
                        "To restore my chakra:\n"
                        "1. Get a free API key from Google AI Studio.\n"
                        "2. Set it in your environment: `GEMINI_API_KEY='your_key'`\n"
                        "3. Restart the server!"
        }
    
    try:
        # Send the message to Gemini
        response = chat_session.send_message(user_message)
        return {"response": response.text}
    except Exception as e:
        return {
            "response": f"Oh no! 🥷 **Kakashi is out of chakra right now, its restoring its chakra so pls wait.**\n\n*(Error detail: `{str(e)}`)*"
        }

# Prompt for Reading Passage Generation
READING_GENERATOR_PROMPT = """You are a Japanese language teacher. 
Generate a short Japanese reading passage and a comprehension quiz based on the user's interest and requested JLPT level.

Level: {level}
Interest: {interest}

Guidelines for the passage:
1. The passage MUST be suited for the requested JLPT level ({level}) in terms of grammar, complexity, and vocabulary.
2. The length should be appropriate (N5: ~3-4 sentences, N4: ~4-6 sentences, N3: ~6-8 sentences, N2: ~8-10 sentences).
3. The content MUST contain raw furigana annotations using the HTML <rt> tag for ALL Kanji characters. Example: '私<rt>わたし</rt>は日<rt>に</rt>本<rt>ほん</rt>に行<rt>い</rt>きます。'.
4. Do NOT wrap Kanji in <ruby> tags, only use raw <rt> tags like '漢字<rt>かんじ</rt>'. The frontend will wrap them dynamically.
5. Provide a dictionary 'hints' mapping complex Japanese words to their English meaning.
6. Provide a 'questions' array containing 1 or 2 multiple-choice questions in Japanese about the passage. Each question must have:
   - 'question': The question text in Japanese.
   - 'options': An array of 4 choices in Japanese.
   - 'answerIndex': The 0-based index of the correct answer.
   - 'explanation': A short explanation in English of why it is correct.

You MUST respond with a raw JSON object only, matching this structure (no markdown fences, no extra text):
{{
  "title": "A short descriptive title in Japanese (with English translation in parentheses)",
  "content": "The passage content with furigana annotations using <rt> tags",
  "hints": {{
    "word": "meaning",
    ...
  }},
  "questions": [
    {{
      "question": "Question text in Japanese",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answerIndex": 0,
      "explanation": "Explanation in English"
    }}
  ]
}}
"""

# High-Quality Pre-Designed Fallback Database
OFFLINE_FALLBACK_READINGS = {
    "N5": {
        "travelling": {
            "title": "日本の旅行 (Traveling in Japan)",
            "content": "私<rt>わたし</rt>は来<rt>らい</rt>月<rt>げつ</rt>日本<rt>にほん</rt>へ旅行<rt>りょこう</rt>に行<rt>い</rt>きます。東京<rt>とうきょう</rt>と京都<rt>きょうと</rt>を見<rt>み</rt>たいです。新幹線<rt>しんかんせん</rt>に乗<rt>の</rt>るのが楽<rt>たの</rt>しみです。",
            "hints": {"来月": "next month", "旅行": "travel", "新幹線": "shinkansen/bullet train", "楽しみ": "looking forward to"},
            "questions": [{
                "question": "私はいつ日本へ行きますか。",
                "options": ["先月", "今月", "来月", "来年"],
                "answerIndex": 2,
                "explanation": "The text says '来月日本へ旅行に行きます' (I will go travel to Japan next month)."
            }]
        },
        "anime": {
            "title": "日本のアニメ (Japanese Anime)",
            "content": "日本<rt>にほん</rt>のアニメは世界<rt>せかい</rt>で有名<rt>ゆうめい</rt>です。私<rt>わたし</rt>の好<rt>す</rt>きなアニメはナルトです。とても面白<rt>おもしろ</rt>い物語<rt>ものがたり</rt>です。",
            "hints": {"世界": "world", "有名": "famous", "好きな": "favorite", "物語": "story"},
            "questions": [{
                "question": "日本のアニメはどうですか。",
                "options": ["有名です", "静かです", "安いです", "古いです"],
                "answerIndex": 0,
                "explanation": "The text states '日本のアニメは世界で有名です' (Japanese anime is famous in the world)."
            }]
        },
        "sports": {
            "title": "私の好きなスポーツ (My Favorite Sport)",
            "content": "私<rt>わたし</rt>はサッカーが好<rt>す</rt>きです。毎週<rt>まいしゅう</rt>土曜日<rt>どようび</rt>に公園<rt>こうえん</rt>で友達<rt>ともだち</rt>と練習<rt>れんしゅう</rt>します。体<rt>からだ</rt>に良いです。",
            "hints": {"毎週": "every week", "練習": "practice", "友達": "friend", "体に良い": "good for the body"},
            "questions": [{
                "question": "私はいつ練習しますか。",
                "options": ["金曜日", "土曜日", "日曜日", "月曜日"],
                "answerIndex": 1,
                "explanation": "The text states '毎週土曜日に...練習します' (I practice every Saturday)."
            }]
        },
        "movies": {
            "title": "映画館で (At the Movie Theater)",
            "content": "昨日<rt>きのう</rt>、友達<rt>ともだち</rt>と映画<rt>えいが</rt>館<rt>かん</rt>に行<rt>い</rt>きました。とても面白いアクション映画<rt>えいが</rt>を見<rt>み</rt>ました。ポップコーンを食べました。",
            "hints": {"昨日": "yesterday", "映画館": "movie theater", "面白い": "interesting", "食べました": "ate"},
            "questions": [{
                "question": "昨日どこへ行きましたか。",
                "options": ["図書館", "映画館", "デパート", "学校"],
                "answerIndex": 1,
                "explanation": "The text says '昨日、友達と映画館に行きました' (Yesterday, I went to the movie theater with my friend)."
            }]
        },
        "music": {
            "title": "日本の音楽 (Japanese Music)",
            "content": "私<rt>わたし</rt>は日本の音楽<rt>おんがく</rt>を聞<rt>き</rt>くのが好きです。毎日<rt>まいにち</rt>学校<rt>がっこう</rt>へ行<rt>い</rt>く時<rt>とき</rt>に聞<rt>き</rt>きます。元気<rt>げんき</rt>になります。",
            "hints": {"音楽": "music", "聞く": "listen", "行く時": "when going", "元気": "energetic/cheerful"},
            "questions": [{
                "question": "私はいつ音楽を聞きますか。",
                "options": ["寝る前", "学校へ行く時", "お風呂の中", "授業中"],
                "answerIndex": 1,
                "explanation": "The text states '毎日学校へ行く時に聞きます' (I listen to it every day when I go to school)."
            }]
        },
        "universe": {
            "title": "夜空の星 (Stars in the Night Sky)",
            "content": "夜<rt>よる</rt>、空<rt>そら</rt>を見<rt>み</rt>ると、たくさんの星<rt>ほし</rt>が見<rt>み</rt>えます。宇宙<rt>うちゅう</rt>はとても広<rt>ひろ</rt>くて不思議<rt>ふしぎ</rt>です。月<rt>つき</rt>も明るいです。",
            "hints": {"空": "sky", "宇宙": "universe/space", "広い": "spacious/wide", "不思議": "mysterious/wonderful"},
            "questions": [{
                "question": "宇宙はどうですか。",
                "options": ["狭いです", "暗いです", "広くて不思議です", "面白くないです"],
                "answerIndex": 2,
                "explanation": "The text states '宇宙はとても広くて不思議です' (The universe is very spacious and mysterious)."
            }]
        }
    },
    "N4": {
        "travelling": {
            "title": "京都の古いお寺 (Old Temples of Kyoto)",
            "content": "京都<rt>きょうと</rt>には古いお寺<rt>てら</rt>がたくさんあります。秋<rt>あき</rt>になると、紅葉<rt>もみじ</rt>がとても美<rt>うつく</rt>しくなり、多くの観光<rt>かんこう</rt>客<rt>きゃく</rt>が訪<rt>おとず</rt>れます。皆<rt>みな</rt>、写真<rt>しゃしん</rt>を撮<rt>と</rt>ります。",
            "hints": {"お寺": "temple", "紅葉": "autumn leaves", "美しく": "beautifully", "観光客": "tourists"},
            "questions": [{
                "question": "京都はいつ美しくなりますか。",
                "options": ["春", "夏", "秋", "冬"],
                "answerIndex": 2,
                "explanation": "The text says '秋になると、紅葉がとても美しくなり...' (In autumn, the autumn leaves become very beautiful)."
            }]
        },
        "anime": {
            "title": "アニメを作る仕事 (The Job of Making Anime)",
            "content": "アニメを作る仕事<rt>しごと</rt>はとても大変<rt>たいへん</rt>ですが、やりがいがあります。多くのアニメーターが毎日<rt>まいにち</rt>遅<rt>おそ</rt>くまで魅力<rt>みりょく</rt>的な絵<rt>え</rt>を描<rt>か</rt>いています。",
            "hints": {"仕事": "job", "大変": "tough/hard", "やりがい": "worth doing", "描く": "draw/paint"},
            "questions": [{
                "question": "アニメを作る仕事はどうですか。",
                "options": ["簡単です", "暇です", "大変ですが、やりがいがあります", "つまらないです"],
                "answerIndex": 2,
                "explanation": "The text states 'アニメを作る仕事はとても大変ですが、やりがいがあります' (Making anime is very tough but rewarding)."
            }]
        },
        "sports": {
            "title": "日本の部活動 (Club Activities in Japan)",
            "content": "日本の学校<rt>がっこう</rt>では、放課後<rt>ほうかご</rt>に部<rt>ぶ</rt>活動<rt>かつどう</rt>が行われます。多くの生徒<rt>せいと</rt>がスポーツ部<rt>ぶ</rt>に入って毎日<rt>まいにち</rt>一生懸命<rt>いっしょうけんめい</rt>に練習<rt>れんしゅう</rt>しています。",
            "hints": {"放課後": "after school", "部活動": "club activities", "生徒": "students", "一生懸命": "with all one's effort"},
            "questions": [{
                "question": "部活動はいつ行われますか。",
                "options": ["朝早く", "授業中", "放課後", "休日だけ"],
                "answerIndex": 2,
                "explanation": "The text states '日本の学校では、放課後に部活動が行われます' (In Japanese schools, club activities are held after school)."
            }]
        },
        "movies": {
            "title": "映画の歴史 (History of Movies)",
            "content": "世界<rt>せいか</rt>で最初の映画<rt>えいが</rt>は白黒<rt>しろくろ</rt>で、音<rt>おと</rt>がありませんでした。現代<rt>げんだい</rt>ではカラーになり、きれいな音楽<rt>おんがく</rt>や迫力<rt>はくりょく</rt>のある3D映像<rt>えいぞう</rt>も楽しめます。",
            "hints": {"最初": "first", "白黒": "black and white", "現代": "modern times", "迫力": "intensity/impact"},
            "questions": [{
                "question": "最初の映画はどうでしたか。",
                "options": ["3D映像でした", "白黒で音がありませんでした", "カラー映画でした", "とても長かったです"],
                "answerIndex": 1,
                "explanation": "The text states '最初の映画は白黒で、音がありませんでした' (The first movie was black and white and had no sound)."
            }]
        },
        "music": {
            "title": "楽器を弾くこと (Playing Instruments)",
            "content": "ピアノやギターなどの楽器<rt>がっき</rt>を弾くことは脳<rt>のう</rt>に良い影響<rt>えいきょう</rt>を与<rt>あた</rt>えます。大人<rt>おとな</rt>になってから趣味<rt>しゅみ</rt>として習<rt>なら</rt>い始める人も多いです。",
            "hints": {"楽器": "instruments", "脳": "brain", "影響": "influence/effect", "趣味": "hobby"},
            "questions": [{
                "question": "楽器を弾くことはどこに良い影響を与えますか。",
                "options": ["足", "目", "脳", "耳だけ"],
                "answerIndex": 2,
                "explanation": "The text states '楽器を弾くことは脳に良い影響を与えます' (Playing instruments has a good effect on the brain)."
            }]
        },
        "universe": {
            "title": "宇宙の旅行 (Traveling to the Moon)",
            "content": "宇宙<rt>うちゅう</rt>飛行<rt>ひこう</rt>士<rt>し</rt>だけでなく、普通の人が月<rt>つき</rt>へ旅行<rt>りょこう</rt>できる時代<rt>じだい</rt>が近づいています。宇宙<rt>うちゅう</rt>旅行の会社<rt>かいしゃ</rt>がいろいろな計画<rt>けいかく</rt>を進めています。",
            "hints": {"宇宙飛行士": "astronaut", "普通の人": "ordinary people", "時代": "era/age", "会社": "company"},
            "questions": [{
                "question": "どのような旅行の時代が近づいていますか。",
                "options": ["新幹線で行く旅行", "普通の人が月へ行く宇宙旅行", "船で行く世界一周旅行", "歩いて行く旅行"],
                "answerIndex": 1,
                "explanation": "The text states '普通の人が月へ旅行できる時代が近づいています' (The era where ordinary people can travel to the moon is approaching)."
            }]
        }
    },
    "N3": {
        "travelling": {
            "title": "温泉文化の魅力 (The Appeal of Hot Spring Culture)",
            "content": "日本には全国<rt>ぜんこく</rt>各地<rt>かくち</rt>に多くの温泉<rt>おんせん</rt>地があり、古くから心<rt>こころ</rt>と体<rt>からだ</rt>を癒やす場所<rt>ばしょ</rt>として親<rt>した</rt>しまれてきました。温泉に浸<rt>つ</rt>かることで血行<rt>けっこう</rt>が良くなり、健康<rt>けんこう</rt>に良い効果<rt>こうか</rt>が得られます。",
            "hints": {"全国各地": "all over the country", "癒やす": "to heal/soothe", "浸かる": "to soak in", "血行": "blood circulation"},
            "questions": [{
                "question": "温泉に浸かることで、どのような効果がありますか。",
                "options": ["風邪をひきやすくなる", "血行が良くなり健康に効果がある", "体が冷えやすくなる", "体重が急激に減る"],
                "answerIndex": 1,
                "explanation": "The passage states '温泉に浸かることで血行が良くなり、健康に良い効果が得られます' (Soaking in hot springs improves blood circulation and yields good health benefits)."
            }]
        },
        "anime": {
            "title": "声優の役割と人気 (The Role and Popularity of Voice Actors)",
            "content": "近年<rt>きんねん</rt>、日本のアニメ人気に伴い、キャラクターに命<rt>いのち</rt>を吹き込む声優<rt>せいゆう</rt>の存在<rt>そんざい</rt>が注目されています。彼らはアフレコだけでなく、歌手<rt>かしゅ</rt>活動<rt>かつどう</rt>やライブも行い、高い人気を得ています。",
            "hints": {"近年": "in recent years", "命を吹き込む": "to breathe life into", "声優": "voice actor", "アフレコ": "after-recording/dubbing"},
            "questions": [{
                "question": "声優はアフレコのほかにどのような活動をしますか。",
                "options": ["アニメの脚本を書く", "歌手活動やライブを行う", "アニメの絵を描く", "映画館のスタッフとして働く"],
                "answerIndex": 1,
                "explanation": "The text states '彼らはアフレコだけでなく、歌手活動やライブも行い...' (They do not only do dubbing, but also singing activities and live concerts)."
            }]
        },
        "sports": {
            "title": "マラソン大会の広がり (The Spread of Marathon Races)",
            "content": "健康<rt>けんこう</rt>志向<rt>しこう</rt>の高まりから、市民<rt>しみん</rt>マラソン大会に参加<rt>さんか</rt>する人が増えています。東京マラソンのような大規模<rt>だいきぼ</rt>な大会では、国内<rt>こくない</rt>外から多くのランナーが参加し、盛り上がりを見せています。",
            "hints": {"健康志向": "health-conscious trend", "市民マラソン": "civilian marathon", "大規模な": "large-scale", "盛り上がり": "excitement/boom"},
            "questions": [{
                "question": "市民マラソンに参加する人が増えている理由は何ですか。",
                "options": ["車が安くなったから", "健康志向が高まっているから", "東京の人口が急に増えたから", "走ることが義務だから"],
                "answerIndex": 1,
                "explanation": "The passage begins '健康志向の高まりから...' indicating the rising health-conscious trend is the reason."
            }]
        },
        "movies": {
            "title": "特撮映画の技術 (Special Effects Movie Technology)",
            "content": "日本には「ゴジラ」に代表<rt>だいひょう</rt>される特撮<rt>とくさつ</rt>映画の長い伝統<rt>でんとう</rt>があります。CG技術が発達<rt>はったつ</rt>した現代<rt>げんだい</rt>でも、ミニチュア模型<rt>もけい</rt>を使った細かな撮影<rt>さつえい</rt>は独自<rt>どくじ</rt>の温かみと魅力を持っています。",
            "hints": {"特撮": "special effects", "発達": "development", "模型": "model/miniature", "独自": "unique"},
            "questions": [{
                "question": "ミニチュア模型を使った撮影にはどのような魅力がありますか。",
                "options": ["安く作れること", "独自の温かみと魅力があること", "完全に実物と同じに見えること", "CGより速く作れること"],
                "answerIndex": 1,
                "explanation": "The text states 'ミニチュア模型を使った細かな撮影は独自の温かみと魅力を持っています'."
            }]
        },
        "music": {
            "title": "ストリートピアノの流行 (The Street Piano Phenomenon)",
            "content": "駅や街頭<rt>がいとう</rt>に誰でも自由に弾けるストリートピアノが設置<rt>せっち</rt>され、人気を集めています。偶然<rt>ぐうぜん</rt>通りかかった人々が美しい演奏<rt>えんそう</rt>に耳を傾<rt>かたむ</rt>け、音楽を通した温かい交流<rt>こうりゅう</rt>が生まれています。",
            "hints": {"街頭": "street/public space", "設置": "install/setup", "通りかかった": "happened to pass by", "交流": "interaction/exchange"},
            "questions": [{
                "question": "ストリートピアノの周囲で何が生まれていますか。",
                "options": ["商品の販売", "激しい議論", "音楽を通した温かい交流", "新しい駅の建設"],
                "answerIndex": 2,
                "explanation": "The text notes '音楽を通した温かい交流が生まれています' (Warm interactions through music are being born)."
            }]
        },
        "universe": {
            "title": "火星探査の最前線 (The Frontier of Mars Exploration)",
            "content": "近年<rt>きんねん</rt>、世界各国の宇宙<rt>うちゅう</rt>機関<rt>きかん</rt>が火星<rt>かせい</rt>探査<rt>たんさ</rt>に力を入れています。過去<rt>かこ</rt>の生命<rt>せいめい</rt>の痕跡<rt>こんせき</rt>を探し、将来<rt>しょうらい</rt>的に人類<rt>じんるい</rt>が移住<rt>いじゅう</rt>できる可能性<rt>かのうせい</rt>を本格的<rt>ほんかくてき</rt>に調査しています。",
            "hints": {"探査": "exploration", "痕跡": "trace/evidence", "移住": "migration/settlement", "可能性": "possibility"},
            "questions": [{
                "question": "火星探査で何を調査していますか。",
                "options": ["宇宙戦争の跡", "人類が将来移住できる可能性", "新しい金属の発見", "植物の栽培方法"],
                "answerIndex": 1,
                "explanation": "The text says they are investigating the possibility of future human settlement ('将来的に人類が移住できる可能性')."
            }]
        }
    },
    "N2": {
        "travelling": {
            "title": "エコツーリズムと持続可能性 (Ecotourism & Sustainability)",
            "content": "近年<rt>きんねん</rt>、観光<rt>かんこう</rt>地における自然<rt>しぜん</rt>環境<rt>かんきょう</rt>の保全<rt>ほぜん</rt>と地域<rt>ちいき</rt>振興<rt>しんこう</rt>を両立<rt>りょうりつ</rt>させるエコツーリズムが脚光<rt>きゃっこう</rt>を浴びています。旅行者は環境負荷<rt>かんきょうふか</rt>を抑えつつ、その土地の歴史を学ぶ姿勢<rt>しせい</rt>が求められます。",
            "hints": {"保全": "preservation", "両立": "coexistence/compatibility", "脚光を浴びる": "gain spotlight", "環境負荷": "environmental load"},
            "questions": [{
                "question": "エコツーリズムとはどのような観光形式ですか。",
                "options": ["とにかく安さを追求する観光", "自然環境の保全と地域振興を両立させる観光", "高級ホテルに滞在するだけの観光", "交通機関を一切使わない観光"],
                "answerIndex": 1,
                "explanation": "The text defines ecotourism as '自然環境の保全と地域振興を両立させる' (balancing preservation of natural environment with regional promotion)."
            }]
        },
        "anime": {
            "title": "アニメ産業の海外進出 (Overseas Expansion of the Anime Industry)",
            "content": "日本のアニメ産業は、動画配信<rt>はいしん</rt>プラットフォームの普及<rt>ふきゅう</rt>により、かつてない規模<rt>だいきぼ</rt>で海外市場<rt>しじょう</rt>を開拓<rt>かいたく</rt>しています。単なる娯楽<rt>ごらく</rt>に留まらず、知的財産<rt>ちてきざいさん</rt>としての価値や影響力が増大<rt>ぞうだい</rt>しています。",
            "hints": {"普及": "spread/diffusion", "市場開拓": "market cultivation", "知的財産": "intellectual property", "増大": "increase/enlargement"},
            "questions": [{
                "question": "アニメ産業が急激に海外市場を開拓できた大きな要因は何ですか。",
                "options": ["絵の描き方が簡単になったこと", "動画配信プラットフォームの普及", "声優の人数が増えたこと", "映画のチケットが値下がりしたこと"],
                "answerIndex": 1,
                "explanation": "The text states '動画配信プラットフォームの普及により...' (Due to the spread of video streaming platforms...)."
            }]
        },
        "sports": {
            "title": "スポーツにおけるAI活用 (AI Utilization in Sports)",
            "content": "現代<rt>げんだい</rt>のプロスポーツ界では、選手の詳細な動作<rt>どうさ</rt>分析<rt>ぶんせき</rt>や審判<rt>しんぱん</rt>の判定<rt>はんてい</rt>支援<rt>しえん</rt>にAIが積極的に導入されています。これにより競技力<rt>きょうぎりょく</rt>向上と公平性の確保が飛躍的<rt>ひやくてき</rt>に進化しています。",
            "hints": {"動作分析": "motion analysis", "判定支援": "judgment support", "競技力向上": "competitiveness enhancement", "飛躍的": "rapidly/leaps and bounds"},
            "questions": [{
                "question": "プロスポーツでAIが導入された目的は何ですか。",
                "options": ["観客を増やすため", "競技力向上と公平性の確保のため", "選手の移動を楽にするため", "テレビ番組の制作を助けるため"],
                "answerIndex": 1,
                "explanation": "The text explicitly states 'これにより競技力向上と公平性の確保が飛躍的に進化しています'."
            }]
        },
        "movies": {
            "title": "映画の社会的役割 (The Social Role of Movies)",
            "content": "映画は単なる娯楽<rt>ごらく</rt>の手段であるだけでなく、社会問題<rt>もんだい</rt>に対する観客の意識<rt>いしき</rt>を喚起<rt>かんき</rt>する強力な媒体<rt>ばいたい</rt>です。ドキュメンタリー映画などは、しばしば社会の仕組みや世論<rt>よろん</rt>を動かす契機<rt>けいき</rt>となります。",
            "hints": {"娯楽": "entertainment", "意識喚起": "raising awareness", "媒体": "medium/channel", "世論": "public opinion"},
            "questions": [{
                "question": "ドキュメンタリー映画などはしばしば社会で何をする契機となりますか。",
                "options": ["科学技術の進歩を遅らせる契機", "世論や社会の仕組みを動かす契機", "子供の遊びを禁止する契機", "新しい言語を作る契機"],
                "answerIndex": 1,
                "explanation": "The text notes 'ドキュメンタリー映画などは、しばしば社会の仕組みや世論を動かす契機となります'."
            }]
        },
        "music": {
            "title": "サブスクリプションによる楽曲の変化 (Changes in Music via Subscriptions)",
            "content": "定額<rt>ていがく</rt>制の音楽配信サービスが主流になったことで、ヒット曲の構造<rt>こうぞう</rt>に変化が生じています。リスナーにスキップされないよう、イントロが極めて短く、サビが早い段階<rt>だんかい</rt>で登場する曲が増えています。",
            "hints": {"定額制": "flat-rate/subscription", "ヒット曲": "hit songs", "サビ": "chorus/hook", "段階": "stage/phase"},
            "questions": [{
                "question": "サブスクリプションサービスの影響で、どのようなヒット曲が増えていますか。",
                "options": ["イントロが非常に長い曲", "イントロが極めて短く、サビが早く登場する曲", "サビが全く存在しない曲", "テンポが非常に遅い曲"],
                "answerIndex": 1,
                "explanation": "The text states 'イントロが極めて短く、サビが早い段階で登場する曲が増えています' to prevent listeners from skipping."
            }]
        },
        "universe": {
            "title": "宇宙デブリ問題の深刻化 (The Gravity of the Space Debris Problem)",
            "content": "役目を終えた人工衛星<rt>えいせい</rt>やロケットの破片<rt>はへん</rt>である「宇宙デブリ」が急増<rt>きゅうぞう</rt>し、宇宙開発の大きな障壁<rt>しょうへき</rt>となっています。超高速で移動するデブリが衝突<rt>しょうとつ</rt>すれば、稼働<rt>かどう</rt>中の衛星が破壊される危険があります。",
            "hints": {"人工衛星": "satellite", "宇宙デブリ": "space debris", "障壁": "barrier/obstacle", "稼働中": "currently operating"},
            "questions": [{
                "question": "宇宙デブリとは何ですか。",
                "options": ["新しい星の物質", "宇宙人の乗り物", "役目を終えた人工衛星やロケットの破片", "宇宙空間に浮く水分"],
                "answerIndex": 2,
                "explanation": "The text states '役目を終えた人工衛星やロケットの破片である「宇宙デブリ」' (space debris, which are fragments of retired satellites and rockets)."
            }]
        }
    }
}

def get_offline_fallback(level, interest):
    category = "travelling"
    interest_clean = interest.strip().lower()
    
    if "travel" in interest_clean or "りょこう" in interest_clean or "旅行" in interest_clean:
        category = "travelling"
    elif "anime" in interest_clean or "manga" in interest_clean or "アニメ" in interest_clean:
        category = "anime"
    elif "sport" in interest_clean or "soccer" in interest_clean or "football" in interest_clean or "スポーツ" in interest_clean or "野球" in interest_clean:
        category = "sports"
    elif "movie" in interest_clean or "cinema" in interest_clean or "film" in interest_clean or "映画" in interest_clean:
        category = "movies"
    elif "music" in interest_clean or "song" in interest_clean or "音楽" in interest_clean or "歌" in interest_clean:
        category = "music"
    elif "universe" in interest_clean or "space" in interest_clean or "star" in interest_clean or "宇宙" in interest_clean or "星" in interest_clean:
        category = "universe"
    else:
        # Check standard presets
        for preset in ["travelling", "anime", "sports", "movies", "music", "universe"]:
            if preset in interest_clean:
                category = preset
                break
                
    fallback = OFFLINE_FALLBACK_READINGS.get(level, {}).get(category)
    if not fallback:
        fallback = OFFLINE_FALLBACK_READINGS["N5"]["travelling"]
        
    fb = copy.deepcopy(fallback)
    fb["offline"] = True
    fb["category"] = category
    return fb

@app.post("/generate_reading")
async def generate_reading(request: Request):
    global client, init_error
    data = await request.json()
    level = data.get("level", "N5").upper()
    interest = data.get("interest", "travelling").strip()
    
    if not level in ["N5", "N4", "N3", "N2"]:
        level = "N5"
        
    # Attempt to query Gemini API
    if client:
        try:
            model_name = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
            prompt = READING_GENERATOR_PROMPT.format(level=level, interest=interest)
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            
            res_text = response.text.strip()
            # Clean markdown code fences if outputted
            if res_text.startswith("```json"):
                res_text = res_text[7:]
            if res_text.endswith("```"):
                res_text = res_text[:-3]
            res_text = res_text.strip()
            
            parsed = json.loads(res_text)
            parsed["offline"] = False
            return parsed
        except Exception as e:
            print(f"Error calling Gemini in generate_reading: {e}")
            # fall through to offline fallback
            
    # Load Offline fallback
    return get_offline_fallback(level, interest)

# Serve static assets and files (mounted after API routes)
app.mount("/assets", StaticFiles(directory="assets"), name="assets")
app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = "0.0.0.0" if (os.environ.get("PORT") or os.environ.get("RENDER")) else "127.0.0.1"
    reload_mode = False if (os.environ.get("PORT") or os.environ.get("RENDER")) else True
    
    uvicorn.run("main:app", host=host, port=port, reload=reload_mode)
