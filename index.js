require('dotenv/config');

const { Client } = require('discord.js');
const { OpenAI } = require('openai');

const CHANNELS = ['1160212223503904840'];       // Channel IDs to listen to

const MAX_CONTEXT_LENGTH = 10;                  // Max number of previous messages to include in the context
const chunkLength = 2000;                       // Discord's max message length is 2000 characters

const client = new Client({
    intents: ['Guilds', 'GuildMembers', 'GuildMessages', 'MessageContent']
});

const conversationHistory = [
    { role: "system", content: "You are a helpful assistant." }
];

const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY,
});

client.on('ready', () => {
    console.log('Ready...');
});

function isRelevantMessage(message) {
    return !message.author.bot && CHANNELS.includes(message.channelId);
}

async function handleTypingIndicator(message) {
    await message.channel.sendTyping();
    return setInterval(() => {
        message.channel.sendTyping();
    }, 5000);
}

function updateConversationHistory(newMessage) {
    conversationHistory.push(newMessage);
    if (conversationHistory.length > MAX_CONTEXT_LENGTH) {
        conversationHistory.shift();
    }
}

async function getOpenAIResponse() {
    try {
        return await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: conversationHistory
        });
    } catch (error) {
        console.log(error);
        return null;
    }
}

async function sendResponseInChunks(message, responseText) {
    const paragraphs = responseText.split('\n');
    let chunk = '';
    for (let i = 0; i < paragraphs.length; i++) {
        if (chunk.length + paragraphs[i].length + 1 <= chunkLength) {
            chunk += (chunk ? ' ' : '') + paragraphs[i];
        } else {
            await message.channel.send(chunk);
            chunk = paragraphs[i];
        }
    }
    if (chunk) {
        await message.channel.send(chunk);
    }
}

client.on('messageCreate', async (message) => {
    if (isRelevantMessage(message)) {
        const sendTypingInterval = await handleTypingIndicator(message);
        updateConversationHistory({ role: 'user', content: message.content });
        const response = await getOpenAIResponse();
        clearInterval(sendTypingInterval);  // Clear the typing indicator interval
        if (response) {
            const assistantResponse = response.choices[0].message.content;
            updateConversationHistory({ role: 'system', content: assistantResponse });
            await sendResponseInChunks(message, assistantResponse);
        }
    }
});

client.login(process.env.TOKEN);
