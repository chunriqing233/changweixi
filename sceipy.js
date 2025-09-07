 const SEND_ICON_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="none" stroke="#000000" stroke-width="1.8"/><path d="M10 17l5-5-5-5" stroke="#000000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

const RECEIVE_ICON_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="none" stroke="#000000" stroke-width="1.8"/><path d="M14 7l-5 5 5 5" stroke="#000000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

document.addEventListener('DOMContentLoaded', () => {

// --- START: Global View Mode Toggle Logic ---

const viewModeBtn = document.getElementById('view-mode-toggle-btn');
const viewModeBtnIcon = viewModeBtn.querySelector('i');

// 切换视图模式的核心函数
const toggleViewMode = () => {
    document.body.classList.toggle('force-fullscreen');

    // 检查当前是否为强制全屏模式，并保存状态
    if (document.body.classList.contains('force-fullscreen')) {
        localStorage.setItem('viewMode', 'fullscreen');
        viewModeBtnIcon.className = 'fas fa-desktop'; // 更新图标
    } else {
        localStorage.setItem('viewMode', 'phone');
        viewModeBtnIcon.className = 'fas fa-mobile-alt'; // 恢复图标
    }
};

// 页面加载时，检查并应用之前保存的模式
const savedViewMode = localStorage.getItem('viewMode');
if (savedViewMode === 'fullscreen') {
    document.body.classList.add('force-fullscreen');
    viewModeBtnIcon.className = 'fas fa-desktop';
}

// --- END: Global View Mode Toggle Logic ---

const PLAY_ICON_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>`;
const PAUSE_ICON_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>`;

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
       
        const j = Math.floor(Math.random() * (i + 1));
      
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

const apiEndpoints = [
    'https://netease-cloud-music-api-five-roan-88.vercel.app',
    'https://netease-cloud-music-api.vercel.app',
    'https://ncm-api.dengxh.cn'
];

const db = new Dexie('AIRP_Beautified_DB');

const renderPublicAccountFeed = () => {
    const feedContainer = document.getElementById('public-account-feed');
    feedContainer.innerHTML = ''; // 清空旧内容

    if (appState.publicAccountPosts.length === 0) {
        feedContainer.innerHTML = `<p style="text-align:center; color:#8a8a8a; margin-top: 40px;">这里还没有任何内容...</p>`;
        return;
    }

    appState.publicAccountPosts.forEach((post, index) => { // 注意这里我们加入了 index
        // 1. 创建卡片的最外层容器
        const item = document.createElement('div');
        item.className = 'gossip-post-item';

        // 2. 创建图片元素
        const image = document.createElement('img');
        image.className = 'gossip-post-image';
        image.src = post.imageUrl;

        // 3. 创建包裹标题和内容的容器
        const textWrapper = document.createElement('div');
        textWrapper.className = 'gossip-post-text-wrapper';

        // 4. 创建标题元素
        const title = document.createElement('h3');
        title.className = 'gossip-post-title';
        title.textContent = post.title;

        // 5. 创建内容段落
        const content = document.createElement('p');
        content.className = 'gossip-post-content';
        content.textContent = post.content;

        // 6. 按照“洋葱模型”把元素一层层组装起来
        textWrapper.appendChild(title);
        textWrapper.appendChild(content);

        item.appendChild(image);
        item.appendChild(textWrapper);
        
        // --- 新增：为公众号卡片添加长按删除功能 ---
        let pressTimer = null;

        const handleLongPress = () => {
            clearTimeout(pressTimer);
            pressTimer = setTimeout(() => {
                deletePublicAccountPost(index); // 调用我们新增的删除函数
            }, 700); // 700毫秒触发长按
        };

        const clearLongPressTimer = () => {
            clearTimeout(pressTimer);
        };

        // 为整个卡片绑定事件
        item.addEventListener('mousedown', handleLongPress);
        item.addEventListener('touchstart', handleLongPress, { passive: true });

        // 当用户松开手指或鼠标移开时，取消计时器
        item.addEventListener('mouseup', clearLongPressTimer);
        item.addEventListener('mouseleave', clearLongPressTimer);
        item.addEventListener('touchend', clearLongPressTimer);
        item.addEventListener('touchcancel', clearLongPressTimer);
        // --- 长按功能添加结束 ---

        // 7. 把最终成型的卡片添加到页面中
        feedContainer.appendChild(item);
    });
};

const updatePromptSelectionDisplay = (chat) => {
    const selectionText = document.getElementById('chat-prompt-selection-text');
    if (!chat.promptIds || chat.promptIds.length === 0) {
        selectionText.textContent = '默认';
        selectionText.classList.add('placeholder');
    } else {
        const selectedTitles = chat.promptIds.map(id => {
            const prompt = appState.prompts.find(p => p.id === id);
            return prompt ? prompt.title : '';
        }).filter(Boolean);

        selectionText.textContent = selectedTitles.join('，') || '默认';
        selectionText.classList.remove('placeholder');
    }
};

const savePromptSelection = async () => {
    const chat = appState.chats[appState.activeChatId];
    if (!chat) return;

    const selectedIds = [];
    document.querySelectorAll('#modal-persona-list input[type="checkbox"]:checked').forEach(checkbox => {
        selectedIds.push(checkbox.value);
    });

    chat.promptIds = selectedIds;

    // 将更改保存到数据库
    await dbStorage.set(KEYS.CHATS, appState.chats);

    updatePromptSelectionDisplay(chat);
    
    closePersonaSelectionModal();
};

// ▼▼▼ 在这里新增这一行 ▼▼▼
let proactiveTimers = {};

    const conditionalTypingStatuses = [
        // 规则1: 检查是否处于“线下阅读模式” (这个是我上次忘了加回去的，现在补上)
        {
            condition: (chat, lastMessage) => chat.isOfflineMode,
            statuses: [
                
                "...",
            ]
        },
        // 规则2: 检查玩家上一句话是否在“质问”
        {
            condition: (chat, lastMessage) => {
                if (typeof lastMessage?.content !== 'string') return false;
                const keywords = ["为什么", "搞什么", "说清楚", "真的吗", "你确定"];
                return keywords.some(word => lastMessage.content.includes(word));
            },
            statuses: [
                "对方正在狡辩...",
                "对方正在编造理由...",
                "对方似乎被问住了...",
                "对方正在思考如何蒙混过关...",
            ]
        },
        // 规则3: 检查 AI 是否心情好 (这是您新增的规则，已修正)
        { // <-- 【修正】加上了开始的大括号
            condition: (chat, lastMessage) => {
                const lastStatusUpdate = chat.history.slice().reverse().find(m => m.role === 'system' && m.content?.type === 'status_update');
                if (!lastStatusUpdate) return false;
                const statusText = lastStatusUpdate.content.status;
                return statusText.includes("开心") || statusText.includes("高兴");
            },
            statuses: [
                "对方的心情似乎很不错...",
                "对方正哼着小曲打字...",
                "对方的指尖在屏幕上轻快地跳跃...",
            ]
        }, // <-- 【修正】这里现在是正确的结束大括号和逗号

      
        {
            condition: (chat, lastMessage) => true, // 这个条件永远为真
            statuses: [
                "对方正在输入中...",
                "对方正在组织语言...",
                "对方打字太慢了...",
                "对方正在想怎么回复你...",
            ]
        }
    ];
    // ▲▲▲ 替换结束 ▲▲▲

    let islandRevertTimeout = null;
    let longPressTriggered = false;
let callTimerInterval = null;

const plusBtn = document.getElementById('toggle-actions-panel-btn');
    const stickerBtn = document.getElementById('toggle-sticker-panel-btn');
    const chatInputArea = document.querySelector('.chat-input-area');
    const actionsPanel = document.getElementById('chat-actions-panel');
    const stickerPanel = document.getElementById('sticker-panel');
    const messagesDiv = document.getElementById('chat-messages');

    const PANEL_OPEN_PADDING = '280px';
    const PANEL_CLOSED_PADDING = '85px';

    const openPanel = (mode) => {
        chatInputArea.classList.add('panel-open');
        messagesDiv.style.transition = 'padding-bottom 0.3s ease-in-out';
        messagesDiv.style.paddingBottom = PANEL_OPEN_PADDING;
        plusBtn.classList.add('active');

        if (mode === 'actions') {
            actionsPanel.style.display = 'grid';
            stickerPanel.style.display = 'none';
            stickerBtn.classList.remove('active');
        } else { // 这是原来的 else 块
    actionsPanel.style.display = 'none';
    stickerPanel.style.display = 'flex';
    stickerBtn.classList.add('active');
    renderStickers();
    switchStickerView('my'); // <--- ▼▼▼ 新增这一行 ▼▼▼
}
    };

    const closePanel = () => {
        chatInputArea.classList.remove('panel-open');
        messagesDiv.style.paddingBottom = PANEL_CLOSED_PADDING;
        plusBtn.classList.remove('active');
        stickerBtn.classList.remove('active');
    };

    // --- 数据库设置 ---
    db.version(1).stores({
        kvStore: 'key',
    });

    const DEFAULT_AVATAR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAARFJREFUeJzt2LEJACEMxEAJ//9/dk8eEMVpU2ecK5eCynLpdDrdz+c55/vnaa3dD5/b2Wtrj/ZgB/ZgB/ZgB/ZgB/bAJ1hrf4s0n2vZTb8d2IMd2IMd2IMd2IMd2IE/sLZe7WubXw/swQ7swQ7swQ7swQ7swR/Y2trZDuxhD3ZgB3ZgB3ZgB3ZgB/ZgB3ZgB3ZgB3ZgB3bA9g7swQ7swQ7swQ7swQ7sAR/Y2tpu9b/ZvwN7sAN7sAN7sAN7sAN7sAN7sAN7sAN7sAN7sAN7sAN7sAN7sAN7sAN7sAN7sAN7sAN7sAN7sAN7sAN/fAERpA3b/e8YAgAAAABJRU5ErkJggg==';

const appState = { 
    apiConfig: { url: '', key: '', model: '' }, 
    personas: { ai: [], my: [] }, 
    chats: {},
    activeChatId: null,
    contacts: [],
    homeWallpaper: null,
    momentsData: { cover: null, avatar: null, posts: [] },
    currentPersonaType: 'ai', 
    editingPresetIndex: -1,
    editingPromptIndex: -1,
    personaSelectionContext: 'ai', 
    newChatTempPersonas: { ai: null, my: null }, 
    videoCallMessages: [],
    currentCallId: null,
    activeTab: 'chat',
    editMode: { chat: false, ai_persona: false, my_persona: false, prompt: false },
    pendingImage: null,
    widgetImages: { bg: null, footer: null, avatar: null },
    stickers: [],
    aiStickers: [], 
    isDarkMode: false,
    prompts: [],
    isMultiSelectMode: false,
    selectedMessages: new Set(),   
    hasNewPublicPosts: false,
    publicAccountPosts: [], 
    activeContextMenu: null,
    replyingToMessage: null,
    editingMessage: null,
    customIcons: {} ,
    tempCustomIcons: {}, 
    currentMomentsRenderIndex: 0,
    pendingSticker: null,
    stickerContext: 'my',
   customFontUrl: '', 
    customCss: '',    
    playlist: [],
    musicSessionPartner: null,            
    globalFontSize: 16,
    bubbleSize: 'medium', 
    currentTrackIndex: -1,
    playbackMode: 'sequential',
    shuffledPlaylist: [],
    defaultBackgroundTexture: '',
    topBarTexture: '',
    bottomBarTexture: '',
    customGlobalCss: ''
};
   

    
    const dbStorage = {
        async get(key, defaultValue) {
            const item = await db.kvStore.get(key);
            return item ? item.value : defaultValue;
        },
        async set(key, value) {
            try {
                await db.kvStore.put({ key, value });
            } catch (e) {
                console.error(`数据库保存失败 (key: ${key}):`, e);
                alert(`数据库保存失败，可能是储存空间已满或发生未知错误: ${e.message}`);
            }
        }
    };
    // ▼▼▼ 使用这段【正确】的代码进行替换 ▼▼▼
const KEYS = {
    API: 'apiConfig',
    CHATS: 'chats',
    CONTACTS: 'user_contacts_list', 
    PERSONA_AI: 'persona_ai',
    PERSONA_MY: 'persona_my',
    HOME_WALLPAPER: 'home_wallpaper',
    MOMENTS_DATA: 'moments_data',
    DECORATIVE_WIDGET_IMAGES: 'decorative_widget_images',
    STICKERS: 'stickers_collection',
   AI_STICKERS: 'ai_stickers_collection', 
    PROMPTS: 'prompts_library',
    DARK_MODE: 'app_dark_mode_status',
    PUBLIC_ACCOUNT_POSTS: 'public_account_posts', 
    CUSTOM_ICONS: 'custom_app_icons', 
    CUSTOM_FONT_URL: 'custom_font_url_v2', 
    CUSTOM_CSS: 'custom_css_v2',

GLOBAL_FONT_SIZE: 'global_font_size_v1',
BUBBLE_SIZE: 'bubble_size_v1', // <--- 新增这一行

    PLAYLIST: 'music_playlist',
    // --- 新增开始 ---
    DEFAULT_BACKGROUND_TEXTURE: 'default_background_texture_v1',
    TOP_BAR_TEXTURE: 'top_bar_texture_v1',
    BOTTOM_BAR_TEXTURE: 'bottom_bar_texture_v1',
    // --- 新增开始 ---
    CUSTOM_GLOBAL_CSS: 'custom_global_css_v1'
    // --- 新增结束 ---
};

    const showScreen = (screenId) => {
         document.querySelectorAll('.screen').forEach(s => {
            if (s.id !== screenId && !s.id.includes('-modal')) {
                s.classList.remove('active');
            }
         });
         const screen = document.getElementById(screenId);
         if (screen) screen.classList.add('active');
    };

    const showCustomConfirm = (title, text, onOkCallback) => {
        const modal = document.getElementById('custom-confirm-modal');
        const customConfirmTitle = document.getElementById('custom-confirm-title');
        const customConfirmText = document.getElementById('custom-confirm-text');
        const customConfirmOkBtn = document.getElementById('custom-confirm-ok-btn');

        customConfirmTitle.textContent = title;
        customConfirmText.innerHTML = text;
        customConfirmOkBtn.onclick = () => {
            if(onOkCallback) onOkCallback();
            hideCustomConfirm();
        };
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
        setTimeout(() => { modal.style.opacity = '1'; }, 10);
    };

    const hideCustomConfirm = () => {
        const modal = document.getElementById('custom-confirm-modal');
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
            modal.style.visibility = 'hidden';
            modal.querySelector('#custom-confirm-ok-btn').onclick = null;
        }, 300); 
    };
    
    const animateAndRemoveItem = (itemElement, onComplete) => {
        return new Promise(resolve => {
            if (!itemElement) {
                if (onComplete) onComplete();
                resolve();
                return;
            }
            // 使用一個稍微快一點的動畫，讓連續消除效果更流暢
            itemElement.style.transition = 'all 0.25s ease-out';
            itemElement.style.transform = 'scale(0.9)';
            itemElement.style.opacity = '0';
            setTimeout(() => {
                if (itemElement) itemElement.remove();
                if (onComplete) onComplete(); // 為了向下相容，仍然呼叫舊的回呼函數
                resolve(); // Promise 完成，通知下一步可以開始了
            }, 250); // 與 CSS transition 時間匹配
        });
    };
    
    const setupFileUploadHelper = (uploadInputId, previewImgId, callback) => {
        const uploadInput = document.getElementById(uploadInputId);
        uploadInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const previewImg = document.getElementById(previewImgId);
                    if (previewImg) previewImg.src = e.target.result;
                    if (callback) callback(e.target.result);
                };
                reader.readAsDataURL(file);
            }
            uploadInput.value = '';
        });
    };

const handleViewAction = (message) => {
    if (!message) return;
    const chat = appState.chats[appState.activeChatId];
    if (!chat) return;

    const contentType = message.type || message.content?.type;

    switch (contentType) {
        case 'retraction':
            const island = document.getElementById('dynamic-island');
            const islandContentWrapper = island.querySelector('.island-content-wrapper');
            const originalContent = message.originalContent;
            if (originalContent && islandContentWrapper) {
                islandContentWrapper.innerHTML = `
                    <div class="island-retraction-view">
                        <p class="label">对方撤回了</p>
                        <p class="content">${originalContent}</p>
                    </div>`;
                
                // 【关键】移除其他外观，添加“查看撤回”外观和“显示”类
                island.classList.remove('default-pill', 'notification-banner');
                island.classList.add('expanded-retraction', 'visible');
                
                islandRevertTimeout = setTimeout(revertIslandToDefault, 5000);
            }
            break;
        // ... (其他 case 保持不变)
        case 'call_log':
            openCallLogView(message.timestamp);
            break;
        default:
            let lastStatus = "AI 目前沒有特殊狀態";
            if (chat.history) {
                for (let i = chat.history.length - 1; i >= 0; i--) {
                    const msg = chat.history[i];
                    if (msg.role === 'system' && msg.content?.type === 'status_update') {
                        lastStatus = msg.content.status;
                        break;
                    }
                }
            }
            updateStatusBubble(lastStatus);
            break;
    }
};

// ▼▼▼ 使用这个【上下文感知版】替换旧的 switchStickerView 函数 ▼▼▼
const switchStickerView = (view) => {
    const myGrid = document.getElementById('chat-sticker-grid-my');
    const aiGrid = document.getElementById('chat-sticker-grid-ai');
    const myBtn = document.getElementById('switch-to-my-stickers');
    const aiBtn = document.getElementById('switch-to-ai-stickers');

    if (view === 'ai') {
        appState.stickerContext = 'ai'; // <-- 核心修改：更新上下文
        myGrid.style.display = 'none';
        aiGrid.style.display = 'grid';
        myBtn.classList.remove('active');
        aiBtn.classList.add('active');
        renderAiStickers();
    } else { // 默认'my'
        appState.stickerContext = 'my'; // <-- 核心修改：更新上下文
        myGrid.style.display = 'grid';
        aiGrid.style.display = 'none';
        myBtn.classList.add('active');
        aiBtn.classList.remove('active');
        renderStickers();
    }
};

// ▼▼▼ 在 <script> 内添加下面这三个新函数 ▼▼▼

// ▼▼▼ 在 <script> 内添加这个新函数 ▼▼▼

// 此函数创建/更新用于全局自定义 CSS 的 <style> 标签
const applyCustomGlobalCss = (cssCode) => {
    let styleTag = document.getElementById('custom-global-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'custom-global-style';
        document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = cssCode || '';
};

// ▲▲▲ 新函数添加到此结束 ▲▲▲

// 应用默认背景贴图 (修正后)
const applyDefaultBackgroundTexture = (url) => {
    let styleTag = document.getElementById('default-bg-texture-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'default-bg-texture-style';
        document.head.appendChild(styleTag);
    }
    if (url && url.trim() !== '') {
        styleTag.innerHTML = `
            /* 1. 为通用内容区域应用全局底图 (已将 #home-screen 移除) */
            .settings-page-content,
            .list-container,
            #main-hub-screen .hub-page,
            #ai-persona-list-screen, #my-persona-list-screen {
                background-image: url('${url}') !important;
                background-size: cover !important;
                background-position: center !important;
                background-color: transparent !important;
            }

            /* 2. 对于聊天屏幕，将底图应用到整个屏幕背景上 */
            #chat-screen {
                background-image: url('${url}') !important;
                background-size: cover !important;
                background-position: center !important;
            }

            /* 3. 同时，让聊天消息区域变透明，这样才能“透”出底图 */
            #chat-messages {
                background-color: transparent !important;
            }
        `;
    } else {
        // 如果清除了全局底图，则移除所有相关样式
        styleTag.innerHTML = '';
    }
};

// 应用顶部栏贴图 (修正后)
const applyTopBarTexture = (url) => {
    let styleTag = document.getElementById('top-bar-texture-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'top-bar-texture-style';
        document.head.appendChild(styleTag);
    }
    if (url && url.trim() !== '') {
        styleTag.innerHTML = `
            /* 这个选择器会选中所有不在 music-player-screen 里的 app-header */
            .screen:not(#music-player-screen) > .app-header {
                background-image: url('${url}') !important;
                background-size: cover !important;
                background-position: center !important;
                background-color: rgba(255, 255, 255, 0.7) !important; /* 添加半透明底色以防文字看不清 */
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
            }
        `;
    } else {
        styleTag.innerHTML = '';
    }
};

// 应用底部栏贴图
const applyBottomBarTexture = (url) => {
    let styleTag = document.getElementById('bottom-bar-texture-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'bottom-bar-texture-style';
        document.head.appendChild(styleTag);
    }
    if (url && url.trim() !== '') {
        styleTag.innerHTML = `
            #tab-bar, .chat-input-area, #chat-actions-panel, #sticker-panel {
                background-image: url('${url}') !important;
                background-size: cover !important;
                background-position: center !important;
            }
        `;
    } else {
        styleTag.innerHTML = '';
    }
};

// ▲▲▲ 新函数添加到此结束 ▲▲▲

// ▼▼▼ 使用这个【功能增强版】完整替换旧的 renderAiStickers 函数 ▼▼▼
const renderAiStickers = () => {
    const container = document.getElementById('chat-sticker-grid-ai');
    container.innerHTML = '';

    // 1. 创建并添加“添加表情”的虚线框
    const addSlot = document.createElement('div');
    addSlot.className = 'add-sticker-slot';
    addSlot.innerHTML = '+';
    addSlot.title = '为对方添加表情包';
    addSlot.onclick = () => {
        // 点击时，同样触发隐藏的文件上传输入框
        document.getElementById('sticker-upload-input').click();
    };
    container.appendChild(addSlot);

    // 2. 遍历并显示所有对方已有的表情包
    appState.aiStickers.forEach((sticker, index) => { // <-- 注意参数是 sticker 和 index
        const img = document.createElement('img');
        img.className = 'sticker-item';
        img.src = sticker.url; // <-- 从对象中获取 url
        img.title = sticker.name; // <-- 从对象中获取 name 作为提示

        // 3. 为对方的每个表情包也绑定“长按删除”功能
        let pressTimer = null;
        let longPressTriggered = false;

        const startPress = (e) => {
            e.preventDefault();
            longPressTriggered = false;
            pressTimer = setTimeout(() => {
                longPressTriggered = true;
                deleteSticker(index); // 调用我们稍后会修改的删除函数
            }, 700);
        };

        const cancelPress = () => {
            clearTimeout(pressTimer);
        };

        // 注意：对方的表情在聊天中不可点击发送，所以这里没有 handleClick
        img.addEventListener('mousedown', startPress);
        img.addEventListener('mouseup', cancelPress);
        img.addEventListener('mouseleave', cancelPress);
        img.addEventListener('touchstart', startPress, { passive: false });
        img.addEventListener('touchend', cancelPress);
        img.addEventListener('touchcancel', cancelPress);
        
        container.appendChild(img);
    });
};

// ▼▼▼ 全新函数 3：让AI随机发送一个“自己的”表情包 ▼▼▼
const sendRandomAiSticker = async () => {
    const chat = appState.chats[appState.activeChatId];
    // 检查对方是否有表情包，以及是否应该发送（可以加个概率）
    if (!chat || appState.aiStickers.length === 0 || Math.random() < 0.7) {
        return; // 70%的概率不发表情包，直接返回
    }

    // 随机挑选一个表情包
    const randomIndex = Math.floor(Math.random() * appState.aiStickers.length);
    const stickerSrc = appState.aiStickers[randomIndex];

    const imageData = { type: 'just_image', url: stickerSrc };
    const timestamp = Date.now() + Math.random();

    // 延迟发送，模仿思考和操作
    await new Promise(res => setTimeout(res, 800));

    appendMessage({ role: 'assistant', content: imageData, timestamp });
    chat.history.push({ role: 'assistant', content: imageData, timestamp });
    await dbStorage.set(KEYS.CHATS, appState.chats);
};

// ▼▼▼ 全新功能：行内编辑 (替换旧的 handleEditAction) ▼▼▼

// 一个辅助函数，用于自动调整textarea的高度
const autoResizeTextarea = (element) => {
    element.style.height = 'auto';
    element.style.height = (element.scrollHeight) + 'px';
};

// 1. 开始行内编辑的核心函数
const startInlineEdit = (message, messageElement) => {
    // 如果已经有正在编辑的消息，或消息不是纯文本，则阻止操作
    if (appState.editingMessage || typeof message.content !== 'string') {
        if (typeof message.content !== 'string') alert('只能编辑纯文本消息。');
        return;
    }

    appState.editingMessage = { timestamp: message.timestamp }; // 标记正在编辑

    const bubble = messageElement.querySelector('.message-bubble');
    const contentDiv = bubble.querySelector('.content');

    // 隐藏原始的消息内容
    contentDiv.style.display = 'none';

    // 创建一个新的 textarea
    const textarea = document.createElement('textarea');
    textarea.className = 'inline-edit-textarea';
    // 将消息内容填入，注意把<br>换回换行符\n
    textarea.value = message.content.replace(/<br\s*\/?>/gi, '\n');

    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'inline-edit-buttons';

    // 创建保存按钮
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '保存';
    saveBtn.className = 'save-btn'; // 复用已有样式
    saveBtn.style.padding = '5px 15px'; // 微调样式
    saveBtn.onclick = () => saveInlineEdit(message, textarea.value, messageElement);

    // 创建取消按钮
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.className = 'action-btn-secondary'; // 复用已有样式
    cancelBtn.style.padding = '5px 15px'; // 微调样式
    cancelBtn.onclick = () => cancelInlineEdit(messageElement);

    // 将按钮添加到容器，再将所有新元素添加到气泡中
    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(saveBtn);
    bubble.appendChild(textarea);
    bubble.appendChild(buttonContainer);

    // 绑定输入事件以自动调整高度，并立即执行一次
    textarea.addEventListener('input', () => autoResizeTextarea(textarea));
    autoResizeTextarea(textarea);
    textarea.focus();
};

// 2. 保存修改
const saveInlineEdit = async (message, newText, messageElement) => {
    const chat = appState.chats[appState.activeChatId];
    const messageIndex = chat.history.findIndex(m => m.timestamp === message.timestamp);

    if (messageIndex > -1) {
        chat.history[messageIndex].content = newText;
        chat.history[messageIndex].edited = true; // 标记为已编辑
        await dbStorage.set(KEYS.CHATS, appState.chats);

        // 更新UI上的内容
        const contentDiv = messageElement.querySelector('.content');
        contentDiv.innerHTML = newText.replace(/\n/g, '<br>');

       
    }
    cancelInlineEdit(messageElement); // 调用取消函数来恢复UI
};

// 3. 取消编辑 (也用于保存后恢复UI)
const cancelInlineEdit = (messageElement) => {
    const bubble = messageElement.querySelector('.message-bubble');
    const contentDiv = bubble.querySelector('.content');
    const textarea = bubble.querySelector('.inline-edit-textarea');
    const buttonContainer = bubble.querySelector('.inline-edit-buttons');

    // 移除我们后加的输入框和按钮
    if (textarea) textarea.remove();
    if (buttonContainer) buttonContainer.remove();

    // 把原始的内容显示回来
    contentDiv.style.display = 'block';

    appState.editingMessage = null; // 清除正在编辑的标记
};
// ▲▲▲ 全新功能代码结束 ▲▲▲

// ▼▼▼ 将这个【遗漏的】函数，完整地添加到你的 <script> 标签内 ▼▼▼
const saveMessageEdit = async () => {
    // 检查是否有正在编辑的消息
    if (!appState.editingMessage || !appState.editingMessage.timestamp) {
        // 如果没有，则安全退出，防止错误
        cancelMessageEdit(); // 顺便清理一下状态
        return;
    }

    const { timestamp, element } = appState.editingMessage;
    
    const newContent = document.getElementById('edit-message-input').value.trim();
    if (!newContent) {
        alert('消息内容不能为空！');
        return;
    }

    const chat = appState.chats[appState.activeChatId];
    const messageIndex = chat.history.findIndex(m => m.timestamp === timestamp);

    if (messageIndex > -1) {
        // 1. 更新内存中的数据
        chat.history[messageIndex].content = newContent;
        chat.history[messageIndex].edited = true; // 添加一个“已编辑”的标记

        // 2. 将更新保存到数据库
        await dbStorage.set(KEYS.CHATS, appState.chats);

        // 3. 更新界面上的消息气泡
        const contentDiv = element.querySelector('.content');
        contentDiv.innerHTML = newContent.replace(/\n/g, '<br>');

       
    }

    // 4. 退出编辑模式
    cancelMessageEdit();
};
// ▲▲▲ 添加到此结束 ▲▲▲

// ▼▼▼ 使用这个版本，替换旧的 cancelMessageEdit 函数 ▼▼▼
const cancelMessageEdit = () => {
    if (!appState.editingMessage) return;

    appState.editingMessage.element.classList.remove('editing-highlight');

    // 【核心修正】: 使用 querySelector 并选择 class 来正确显示主输入框
    document.getElementById('edit-message-bar').style.display = 'none';
    document.querySelector('.chat-input-row').style.display = 'flex';

    appState.editingMessage = null;
};

const handleRegenerateAction = async (clickedMessage) => {
    // 安全檢查：此功能只對AI的消息有效
    if (clickedMessage.role !== 'assistant') return;

    const chat = appState.chats[appState.activeChatId];
    if (!chat) return;

    // 1. 尋找被點擊消息的索引
    const clickedMessageIndex = chat.history.findIndex(m => m.timestamp === clickedMessage.timestamp);
    if (clickedMessageIndex === -1) return;

    // 2. 向上和向下查找，確定AI這次完整回覆的範圍（這部分邏輯不變）
    let startIndex = clickedMessageIndex;
    let endIndex = clickedMessageIndex;

    for (let i = clickedMessageIndex - 1; i >= 0; i--) {
        const msg = chat.history[i];
        if (msg.role === 'assistant' || (msg.role === 'system' && (msg.content?.type === 'status_update' || msg.type === 'retraction'))) {
            startIndex = i;
        } else {
            break;
        }
    }
    for (let i = clickedMessageIndex + 1; i < chat.history.length; i++) {
        const msg = chat.history[i];
        if (msg.role === 'assistant' || (msg.role === 'system' && (msg.content?.type === 'status_update' || msg.type === 'retraction'))) {
            endIndex = i;
        } else {
            break;
        }
    }

    // ▼▼▼【核心動畫修改】▼▼▼
    // 3. 收集所有需要刪除的消息
    const messagesToDelete = chat.history.slice(startIndex, endIndex + 1);

    // 4. 建立一個反轉的陣列，這樣我們可以從下往上（從新到舊）依序刪除消息氣泡
    const reversedMessages = messagesToDelete.slice().reverse();
    for (const msg of reversedMessages) {
        const element = document.getElementById(`message-${msg.timestamp}`);
        if (element) {
            // 先處理附屬的元素（如引用條），等待它消失
            const nextElement = element.nextElementSibling;
            if (nextElement && (nextElement.classList.contains('quote-reply-container') || nextElement.classList.contains('voice-text-bubble'))) {
                await animateAndRemoveItem(nextElement);
            }
            // 再處理消息氣泡本身，並等待它消失
            await animateAndRemoveItem(element);
        }
    }
    // ▲▲▲ 修改結束 ▲▲▲

    // 5. 從 appState 的歷史記錄中一次性刪除這些消息
    const deleteCount = endIndex - startIndex + 1;
    chat.history.splice(startIndex, deleteCount);

    // 6. 保存狀態到資料庫
    await dbStorage.set(KEYS.CHATS, appState.chats);

    // 7. 觸發重新生成
    await receiveMessageHandler();
};

    const deleteMessage = (timestamp) => {
        const chat = appState.chats[appState.activeChatId];
        if (!chat) return;
        const messageIndex = chat.history.findIndex(msg => msg.timestamp === timestamp);
        if (messageIndex > -1) {
            showCustomConfirm('删除消息', '您确定要删除这条消息吗?', async () => {
                chat.history.splice(messageIndex, 1);
                await dbStorage.set(KEYS.CHATS, appState.chats);
                const messageElement = document.getElementById(`message-${timestamp}`);
                if (messageElement) animateAndRemoveItem(messageElement);
                const transcriptionBubble = document.getElementById(`transcription-${timestamp}`);
                if (transcriptionBubble) transcriptionBubble.remove();
            });
        }
    };

// --- ▼▼▼ 請使用這個【最終正確版】來替換舊的 addInteractionHandlers 函數 ▼▼▼ ---
const addInteractionHandlers = (element, message) => {
    let pressTimer = null;
    let isLongPress = false;
    const longPressTime = 500;

    const handleShortPress = (targetElement) => {
        if (appState.isMultiSelectMode) {
            toggleMessageSelection(message, element);
            return;
        }

        if (!message || typeof message.content !== 'object' || message.content === null) return;
        
        // ▼▼▼ 核心修改在這裡 ▼▼▼
        if (message.role === 'assistant' && (message.content.type === 'transfer' || message.content.type === 'send_transfer')) {
            if (targetElement.closest('.transfer-content')) {
                // 只有在紅包既沒有被接收，也沒有被退回時，才彈出確認框
                if (!message.content.isReceived && !message.content.isReturned) {
                    showRedPacketConfirm(message, element);
                }
                return;
            }
        }
        // ▲▲▲ 修改結束 ▲▲▲
        
        switch (message.content.type) {
            case 'retraction':
                clearTimeout(islandRevertTimeout);
                const island = document.getElementById('dynamic-island');
                const islandContentWrapper = island.querySelector('.island-content-wrapper');
                const originalContent = message.content.originalContent;
                if (originalContent && islandContentWrapper) {
                    islandContentWrapper.innerHTML = `
                        <div class="island-retraction-view">
                            <p class="label">对方撤回了</p>
                            <p class="content">${originalContent}</p>
                        </div>`;
                    island.classList.add('expanded-retraction', 'visible');
                    islandRevertTimeout = setTimeout(revertIslandToDefault, 5000);
                }
                return;

            case 'call_log':
                openCallLogView(message.timestamp);
                return;
        }
    };

    const handleLongPress = (targetElement) => {
        if (appState.isMultiSelectMode) return;

        const imageTextCard = targetElement.closest('.image-text-content');
        if (imageTextCard) {
            const cover = imageTextCard.querySelector('.image-text-cover');
            const details = imageTextCard.querySelector('.image-text-details');
            if (cover && details) {
                const isCoverVisible = cover.style.display !== 'none';
                cover.style.display = isCoverVisible ? 'none' : 'flex';
                details.style.display = isCoverVisible ? 'block' : 'none';
            }
            return;
        }

        if (message && typeof message.content === 'object' && message.content !== null) {
            if (message.content.type === 'voice' || message.content.type === 'send_voice') {
                if (targetElement.closest('.voice-message-body')) {
                    toggleTranscription(message.timestamp);
                    return;
                }
            }
        }
        
        showContextMenu(message, element);
    };

    const startPress = (e) => {
        isLongPress = false;
        pressTimer = setTimeout(() => {
            isLongPress = true;
            handleLongPress(e.target);
        }, longPressTime);
    };

    const endPress = (e) => {
        clearTimeout(pressTimer);
        if (!isLongPress) {
            handleShortPress(e.target);
        }
    };

    element.addEventListener('mousedown', startPress);
    element.addEventListener('mouseup', endPress);
    element.addEventListener('mouseleave', () => clearTimeout(pressTimer));
    element.addEventListener('touchstart', startPress, { passive: true });
    element.addEventListener('touchend', endPress);
    element.addEventListener('touchcancel', () => clearTimeout(pressTimer));
};
// --- ▲▲▲ 替換到此結束 ▲▲▲ ---


const toggleTranscription = (timestamp) => { 
    const parentWrapper = document.getElementById(`message-${timestamp}`);
    if (!parentWrapper) return;

    const existingBubble = parentWrapper.nextElementSibling;
    if (existingBubble && existingBubble.classList.contains('voice-text-bubble')) {
        existingBubble.remove();
        return;
    }
    
    document.querySelector('.voice-text-bubble')?.remove();

    const chat = appState.chats[appState.activeChatId];
    if (!chat) return;

    const message = chat.history.find(m => m.timestamp === timestamp);
    // 安全检查：确保消息和语音文本都存在
    if (!message || typeof message.content !== 'object' || !message.content.text) return;

    const senderClass = message.role === 'user' ? 'user' : 'ai';
    
    const textBubbleWrapper = document.createElement('div');
    textBubbleWrapper.className = `message-wrapper ${senderClass} voice-text-bubble`;

    const newBubble = document.createElement('div');
    newBubble.className = `message-bubble ${senderClass} voice-text-translation`;
    
    const newAvatar = document.createElement('img');
    newAvatar.className = 'avatar';
    newAvatar.src = (senderClass === 'user' ? chat.personas.my.avatar : chat.personas.ai.avatar) || DEFAULT_AVATAR;

    const newContentDiv = document.createElement('div');
    newContentDiv.className = 'content';
    newContentDiv.innerHTML = message.content.text.replace(/\n/g, '<br>');

    newBubble.appendChild(newContentDiv);
    textBubbleWrapper.appendChild(newAvatar);
    textBubbleWrapper.appendChild(newBubble);
    
    parentWrapper.insertAdjacentElement('afterend', textBubbleWrapper);
    setTimeout(() => { textBubbleWrapper.style.opacity = '1'; }, 10);
};

// ▼▼▼ 新增此函数 ▼▼▼
const prependMessage = (message, container) => {
    const chat = appState.chats?.[appState.activeChatId];
    if (!chat) return;

    // --- 这部分逻辑和 appendMessage 完全一样 ---
    const { role, content: contentData, timestamp, author: authorName, replyTo, edited } = message;

    if (role.toLowerCase() === 'system') {
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble system';
        bubble.id = `message-${timestamp}`;
        const systemContent = (typeof contentData === 'object' && contentData.content) ? contentData.content : contentData;
        bubble.textContent = systemContent;
        if (typeof contentData === 'object' && contentData.type === 'retraction') {
            bubble.classList.add('retraction-notice');
            bubble.title = '点击查看被撤回的内容';
        } else if (typeof contentData === 'object' && contentData.type === 'call_log') {
            bubble.classList.add('clickable-log');
            bubble.title = '点击查看通话记录';
        }
        addInteractionHandlers(bubble, message);
        container.prepend(bubble); // 【核心区别】使用 prepend
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper';
    wrapper.id = `message-${timestamp}`;
    const isUser = role.toLowerCase() !== 'assistant';
    const senderClass = isUser ? 'user' : 'ai';
    wrapper.classList.add(senderClass);

    const avatar = document.createElement('img');
    avatar.className = 'avatar';
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${senderClass}`;

    if (isUser) {
        avatar.src = chat.personas.my.avatar || DEFAULT_AVATAR;
    } else {
        const persona = (chat.type === 'group' ? chat.personas.ai.find(p => p.name === authorName) : chat.personas.ai) || {};
        avatar.src = persona.avatar || DEFAULT_AVATAR;
        if (chat.type === 'group' && authorName) {
            const nameDiv = document.createElement('div'); nameDiv.className = 'sender-name'; nameDiv.textContent = authorName; bubble.appendChild(nameDiv);
        }
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'content';
    
    // (此处省略了所有 contentData 的 switch-case 判断，因为它们和 appendMessage 完全相同)
    // ... 为了简洁，这里省略了和 appendMessage 中完全一样的 switch-case 逻辑 ...
    const isString = typeof contentData === 'string';
    if (isString) {
        contentDiv.innerHTML = contentData.replace(/\n/g, '<br>');
    } else if (contentData && typeof contentData === 'object') {
        switch(contentData.type) {
             case 'voice':
            case 'send_voice':
                bubble.classList.add('is-voice-message'); 
                const duration = contentData.duration || 5; 
                const durationFormatted = `${duration}"`; 
                const minWidth = 65; const maxWidth = 220; 
                let width = minWidth + (duration - 1) * 2.8; 
                width = Math.min(width, maxWidth); 
                const playIconSrc = senderClass === 'user' ? "https://i.postimg.cc/T33ZcS3N/IMG-5037.gif" : "https://i.postimg.cc/MHMVmzjb/IMG-5046.gif"; 
                contentDiv.innerHTML = `<div class="voice-message-body" style="width: ${width}px;" data-text="${contentData.text}"><img src="${playIconSrc}" class="voice-play-icon"><span class="voice-duration">${durationFormatted}</span></div>`;
                break;
            case 'location':
                contentDiv.classList.add('location-content'); 
                contentDiv.innerHTML = `<div class="location-text-overlay">${contentData.address}</div>`;
                break;
            // --- ▼▼▼ 請使用這個版本替換舊的 transfer case ▼▼▼ ---
            case 'transfer':
            case 'send_transfer':
                contentDiv.classList.add('transfer-content');
                const amount = Number(contentData.amount).toFixed(2);
                let detailsHTML = '';
                let footerText = '微信转账';

                if (contentData.statusText === '已收款') {
                    detailsHTML = `<div class="transfer-details"><div class="transfer-amount">¥${amount}</div><div class="transfer-remark">已收款</div></div>`;
                    contentDiv.style.backgroundColor = '#fde1c3';
                } 
                // ... 在 appendMessage 的 switch 區塊內 ...
else if (contentData.statusText === '已退回') {
    detailsHTML = `<div class="transfer-details"><div class="transfer-amount">¥${amount}</div><div class="transfer-remark">已退回</div></div>`;
    contentDiv.style.backgroundColor = '#fde1c3';
    footerText = '已退回'; // <--- 請加上這一行
}
                else {
                    const remarkHTML = contentData.remark ? `<div class="transfer-remark">${contentData.remark}</div>` : '';
                    detailsHTML = `<div class="transfer-details"><div class="transfer-amount">¥${amount}</div>${remarkHTML}</div>`;
                    if (contentData.isReceived) {
                        footerText = (senderClass === 'user') ? '对方已收款' : '已被收款';
                        contentDiv.style.backgroundColor = '#fde1c3';
                    } else {
                        footerText = '微信转账';
                        contentDiv.style.backgroundColor = '#F8A94A';
                    }
                }
                contentDiv.innerHTML = `<div class="transfer-top-section"><div class="transfer-icon">¥</div>${detailsHTML}</div><div class="transfer-footer">${footerText}</div>`;
                break;
            case 'just_image':
                contentDiv.className = 'content just-image-content'; 
                contentDiv.innerHTML = `<img src="${contentData.url}" alt="image-message">`;
                break;
            case 'image':
    contentDiv.className = 'content image-text-content';
    contentDiv.innerHTML = `
        <div class="image-text-cover"><img src="https://i.postimg.cc/RF2kGBvN/A0-E8-A59-DE8-E7368-B0824-AA62553191-E8.jpg" style="width: 100%; height: 100%; object-fit: cover;"></div>
        <div class="image-text-details" style="display: none;">${contentData.text.replace(/\n/g, '<br>')}</div>
    `;
    break;
        }
    }


    bubble.appendChild(contentDiv);
   
    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    addInteractionHandlers(wrapper, message);
    
    // --- 引用消息的处理 ---
    if (replyTo && replyTo.timestamp) {
        const quoteContainer = document.createElement('div');
        quoteContainer.className = `quote-reply-container ${senderClass}`;
        const quoteBox = document.createElement('div');
        quoteBox.className = 'quote-reply-box';
        let quoteAuthorName = '';
        if (replyTo.role === 'user') { quoteAuthorName = chat.personas.my.name; } else { const persona = (chat.type === 'group' ? chat.personas.ai.find(p => p.name === replyTo.author) : chat.personas.ai) || {}; quoteAuthorName = persona.name || 'AI'; }
        quoteBox.textContent = `${quoteAuthorName}: ${summarizeLastMessage(replyTo)}`;
        quoteContainer.appendChild(quoteBox);
        
        // 【核心区别】因为消息本身是往前插，所以引用条要插在消息后面
        wrapper.insertAdjacentElement('afterend', quoteContainer);
    }
    
    container.prepend(wrapper); // 【核心区别】使用 prepend
};

const handleAIPokeUser = async () => {
    const chat = appState.chats[appState.activeChatId];
    if (!chat) return; // 安全检查

    // 1. 在界面上显示“[AI]拍了拍你”
    const pokeText = `“${chat.personas.ai.name}”拍了拍你`;
    // 使用我们现有的函数来添加系统消息，它会自动应用样式
    await appendSystemMessageToChat({ content: pokeText, type: 'poke' });

        const hiddenSystemMessage = {
        role: 'system',
        content: '[重要系统事件：用户刚刚“拍了拍”你。这是一个需要你立即回应的互动。请你放下正在做的事情，用符合你角色设定的口吻，对这个“拍一拍”动作本身做出反应。例如，你可以表现出惊讶、好奇、被打扰或开心的情绪。]',
        hidden: true, 
        timestamp: Date.now() + 1
    };
    chat.history.push(hiddenSystemMessage);

    await dbStorage.set(KEYS.CHATS, appState.chats);

};

// ▼▼▼ 使用这个【全局版本】替换旧的 applyCustomFont 函数 ▼▼▼
const applyCustomFont = (fontUrl) => {
    let styleTag = document.getElementById('custom-font-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'custom-font-style';
        document.head.appendChild(styleTag);
    }

    if (fontUrl && fontUrl.trim() !== '') {
        // 当提供了有效的 URL 时，生成 @font-face 规则
        styleTag.innerHTML = `
@font-face {
  font-family: 'UserCustomFont'; /* 定义一个固定的字体族名 */
  src: url('${fontUrl}') format('truetype');
  font-display: swap;
}
/* 将这个新字体应用到整个应用，并用 !important 提高优先级 */
#phone-screen, #phone-screen input, #phone-screen textarea, #phone-screen button {
  font-family: 'UserCustomFont', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
}`;
    } else {
        // 如果 URL 为空，则清空样式，恢复默认字体
        styleTag.innerHTML = '';
    }
};
// ▲▲▲ 替换结束 ▲▲▲

// ▼▼▼ 使用这个【修正版】替换旧的 applyGlobalFontSize 函数 ▼▼▼
const applyGlobalFontSize = (size) => {
    let styleTag = document.getElementById('global-font-size-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'global-font-size-style';
        document.head.appendChild(styleTag);
    }
    // 【核心修正】在样式规则末尾添加 !important 来强制覆盖其他样式
    styleTag.innerHTML = `#phone-screen { font-size: ${size}px !important; }`;
};
// ▲▲▲ 替换结束 ▲▲▲

const applyBubbleSize = (size) => {
    const phoneScreen = document.getElementById('phone-screen');
    // 先移除所有可能存在的尺寸类，再添加当前选择的类
    phoneScreen.classList.remove('bubble-small', 'bubble-large');

    if (size === 'small') {
        phoneScreen.classList.add('bubble-small');
    } else if (size === 'large') {
        phoneScreen.classList.add('bubble-large');
    }
    // 如果是 'medium'，则不添加任何类，使用默认样式
};

document.head.insertAdjacentHTML('beforeend', '<style id="live-preview-styles"></style>');

const updateLivePreview = () => {
    const fontUrl = document.getElementById('custom-font-url-input').value.trim();
    const fontSize = document.getElementById('global-font-size-slider').value;
    const bubbleSize = document.querySelector('#bubble-size-selector .segmented-control-button.active').dataset.size;
    const customCss = document.getElementById('custom-css-input').value.trim();
    const customGlobalCss = document.getElementById('custom-global-css-input').value.trim();

    const modalPreviewContainer = document.getElementById('preview-phone-screen-container');
    const previewStyleTag = document.getElementById('live-preview-styles');

    if (!previewStyleTag || !modalPreviewContainer) return;

    // Apply bubble size class
    modalPreviewContainer.classList.remove('bubble-small', 'bubble-large');
    if (bubbleSize === 'small') modalPreviewContainer.classList.add('bubble-small');
    if (bubbleSize === 'large') modalPreviewContainer.classList.add('bubble-large');

    let newStyles = `/* --- 实时预览动态样式 --- */\n`;

    // Font URL
    if (fontUrl) {
        newStyles += `
        @font-face {
            font-family: 'PreviewCustomFont';
            src: url('${fontUrl}') format('truetype');
        }
        #preview-phone-screen-container, 
        #preview-phone-screen-container .content {
            font-family: 'PreviewCustomFont', sans-serif !important;
        }\n`;
    }

    // Font Size
    newStyles += `
    #preview-phone-screen-container {
        font-size: ${fontSize}px !important;
    }\n`;

    // Apply Textures from appState
    if (appState.topBarTexture) {
        newStyles += `
        #preview-phone-screen-container .preview-header {
            background-image: url('${appState.topBarTexture}') !important;
            background-size: cover !important;
            background-position: center !important;
        }\n`;
    }
    if (appState.bottomBarTexture) {
        newStyles += `
        #preview-phone-screen-container .preview-footer {
            background-image: url('${appState.bottomBarTexture}') !important;
            background-size: cover !important;
            background-position: center !important;
        }\n`;
    }
    if (appState.defaultBackgroundTexture) {
         newStyles += `
        #preview-phone-screen-container .preview-messages {
            background-image: url('${appState.defaultBackgroundTexture}') !important;
            background-color: transparent !important;
            background-size: cover !important;
            background-position: center !important;
        }\n`;
    }

    // Scope and apply Bubble CSS
    if (customCss) {
        const scopedCustomCss = customCss.replace(/(^|{|})\s*([^,{}]*?)\s*{/g, (match, p1, p2) => {
            if (p2.trim().startsWith('@')) return match;
            const modalSelectors = p2.split(',').map(s => `#preview-phone-screen-container ${s.trim()}`).join(', ');
            return `${p1} ${modalSelectors} {`;
        });
        newStyles += scopedCustomCss;
    }

    // Scope and apply Global CSS
    if (customGlobalCss) {
        const scopedGlobalCss = customGlobalCss.replace(/(^|{|})\s*([^,{}]*?)\s*{/g, (match, p1, p2) => {
            if (p2.trim().startsWith('@')) return match;
            const modalSelectors = p2.split(',').map(s => `#preview-phone-screen-container ${s.trim()}`).join(', ');
            return `${p1} ${modalSelectors} {`;
        });
        newStyles += scopedGlobalCss;
    }

    previewStyleTag.innerHTML = newStyles;
};

const setupBeautifyPreviewListeners = () => {
    // 监听所有输入框和按钮的变化，一旦变化就调用更新函数
    document.getElementById('custom-font-url-input').addEventListener('input', updateLivePreview);
    document.getElementById('custom-css-input').addEventListener('input', updateLivePreview);
    document.getElementById('global-font-size-slider').addEventListener('input', updateLivePreview);
    document.querySelectorAll('#bubble-size-selector .segmented-control-button').forEach(button => {
        button.addEventListener('click', updateLivePreview);
    });
};
// ▲▲▲ 全新代码块结束 ▲▲▲

// 此函数创建/更新用于自定义 CSS 的 <style> 标签，并控制总开关
const applyCustomCss = (cssCode) => {
    let styleTag = document.getElementById('custom-bubble-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'custom-bubble-style';
        document.head.appendChild(styleTag);
    }
    // 步骤1：注入用户自己的CSS（不变）
    styleTag.innerHTML = cssCode || '';

    // 步骤2：根据用户是否输入了CSS，来添加或移除“总开关”class
    const phoneScreen = document.getElementById('phone-screen');
    if (cssCode && cssCode.trim() !== '') {
        // 如果有自定义CSS，就开启总开关，让原生样式失效
        phoneScreen.classList.add('custom-bubble-mode-active');
    } else {
        // 如果没有自定义CSS，就关闭总开关，让原生样式恢复
        phoneScreen.classList.remove('custom-bubble-mode-active');
    }
};

// ▼▼▼ 请使用这个【外观修改版】来完整替换旧的 handlePokeAi 函数 ▼▼▼
const handlePokeAi = async (message) => {
    const chat = appState.chats[appState.activeChatId];
    if (!chat || message.role !== 'assistant') return; // 安全检查

    const pokeText = `你拍了拍“${message.author || chat.personas.ai.name}”`;
    const timestamp = Date.now();

    // 1. 【核心修改】创建一个带有特殊类型 'user_poke' 的用户消息对象
    //    它的 role 依然是 'user'，这保证了逻辑的正确性。
    const userPokeMessage = {
        role: 'user',
        content: {
            type: 'user_poke',
            text: pokeText
        },
        timestamp: timestamp
    };

    // 2. 调用 appendMessage 来处理这条特殊消息
    //    我们将在下一步修改 appendMessage，让它能识别并特殊处理 'user_poke' 类型。
    appendMessage(userPokeMessage);
    chat.history.push(userPokeMessage);

    // 3. (保留) 继续在后台添加隐藏的系统指令，确保AI能准确回应
    const hiddenSystemMessage = {
        role: 'system',
        content: `[重要系统事件：用户刚刚通过“拍一拍”的动作，发送了消息：“${pokeText}”。这是一个需要你立即回应的互动。请你放下正在做的事情，用符合你角色设定的口吻，对这个动作本身做出反应。]`,
        hidden: true,
        timestamp: timestamp + 1 
    };
    chat.history.push(hiddenSystemMessage);

    // 4. 保存并触发AI回应 (不变)
    await dbStorage.set(KEYS.CHATS, appState.chats);
};

const appendMessage = (message) => {
    const messagesDiv = document.getElementById('chat-messages');
    const chat = appState.chats?.[appState.activeChatId];
    if (!chat) return;

    const { role, content: contentData, timestamp, author: authorName, replyTo, edited } = message;

    if (role.toLowerCase() === 'system') {
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble system';
        if (typeof contentData === 'object' && contentData.type === 'poke') {
            bubble.classList.add('poke-notice');
        }
        bubble.id = `message-${timestamp}`;
        const systemContent = (typeof contentData === 'object' && contentData.content) ? contentData.content : contentData;
        bubble.textContent = systemContent;
        if (typeof contentData === 'object' && contentData.type === 'retraction') {
            bubble.classList.add('retraction-notice');
            bubble.title = '点击查看被撤回的内容';
        } else if (typeof contentData === 'object' && contentData.type === 'call_log') {
            bubble.classList.add('clickable-log');
            bubble.title = '点击查看通话记录';
        }
        addInteractionHandlers(bubble, message);
        messagesDiv.appendChild(bubble);
        bubble.classList.add('message-appear-animation');
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper';
    wrapper.id = `message-${timestamp}`;
    const isUser = role.toLowerCase() !== 'assistant';

    if (isUser && typeof contentData === 'object' && contentData.type === 'user_poke') {
        const pokeBubble = document.createElement('div');
        pokeBubble.className = 'message-bubble system poke-notice';
        pokeBubble.id = `message-${timestamp}`;
        pokeBubble.textContent = contentData.text;
        messagesDiv.appendChild(pokeBubble);
        pokeBubble.classList.add('message-appear-animation');
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        return;
    }

    const senderClass = isUser ? 'user' : 'ai';
    wrapper.classList.add(senderClass);

    const avatar = document.createElement('img');
    avatar.className = 'avatar';

    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${senderClass}`;

    if (isUser) {
        avatar.src = chat.personas.my.avatar || DEFAULT_AVATAR;
    } else {
        const persona = (chat.type === 'group' ? chat.personas.ai.find(p => p.name === authorName) : chat.personas.ai) || {};
        avatar.src = persona.avatar || DEFAULT_AVATAR;
        if (senderClass === 'ai') {
             avatar.addEventListener('dblclick', () => {
                handlePokeAi(message);
            });
        }
        if (chat.type === 'group' && authorName) {
            const nameDiv = document.createElement('div'); nameDiv.className = 'sender-name'; nameDiv.textContent = authorName; bubble.appendChild(nameDiv);
        }
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'content';

    const isString = typeof contentData === 'string';
    if (isString) {
        if (senderClass === 'ai' && chat.isOfflineMode && contentData.length > 200) {
            const paragraphs = contentData.split('\n');
            paragraphs.forEach(p_text => {
                if (p_text.trim() !== '') {
                    const p_element = document.createElement('p');
                    p_element.textContent = p_text;
                    contentDiv.appendChild(p_element);
                }
            });
        } else {
            contentDiv.innerHTML = contentData.replace(/\n/g, '<br>');
        }
    } else if (contentData && typeof contentData === 'object') {
        switch(contentData.type) {
            case 'voice':
            case 'send_voice':
                bubble.classList.add('is-voice-message'); 
                const duration = contentData.duration || 5; 
                const durationFormatted = `${duration}"`; 
                const minWidth = 65; const maxWidth = 220; 
                let width = minWidth + (duration - 1) * 2.8; 
                width = Math.min(width, maxWidth); 
                const playIconSrc = senderClass === 'user' ? "https://i.postimg.cc/T33ZcS3N/IMG-5037.gif" : "https://i.postimg.cc/MHMVmzjb/IMG-5046.gif"; 
                contentDiv.innerHTML = `<div class="voice-message-body" style="width: ${width}px;" data-text="${contentData.text}"><img src="${playIconSrc}" class="voice-play-icon"><span class="voice-duration">${durationFormatted}</span></div>`;
                break;
            case 'location':
                contentDiv.classList.add('location-content'); 
                contentDiv.innerHTML = `<div class="location-text-overlay">${contentData.address}</div>`;
                break;
            case 'transfer':
            case 'send_transfer':
                contentDiv.classList.add('transfer-content');
                const amount = Number(contentData.amount).toFixed(2);
                let detailsHTML = '';
                let footerText = '微信转账';
                const remarkHTML = contentData.remark ? `<div class="transfer-remark">${contentData.remark}</div>` : '';
                detailsHTML = `<div class="transfer-details"><div class="transfer-amount">¥${amount}</div>${remarkHTML}</div>`;
                if (contentData.statusText === '已收款') {
                    detailsHTML = `<div class="transfer-details"><div class="transfer-amount">¥${amount}</div><div class="transfer-remark">已收款</div></div>`;
                    contentDiv.style.backgroundColor = '#fde1c3';
                } else {
                    if (contentData.isReceived) {
                        footerText = (senderClass === 'user') ? '对方已收款' : '已被收款';
                        contentDiv.style.backgroundColor = '#fde1c3';
                    } else {
                        footerText = '微信转账';
                        contentDiv.style.backgroundColor = '#F8A94A';
                    }
                }
                contentDiv.innerHTML = `<div class="transfer-top-section"><div class="transfer-icon">¥</div>${detailsHTML}</div><div class="transfer-footer">${footerText}</div>`;
                break;
            // ▼▼▼ 核心修正：在这里添加一个 case 来处理 sticker 类型 ▼▼▼
            case 'sticker':
            case 'just_image':
                contentDiv.className = 'content just-image-content'; 
                contentDiv.innerHTML = `<img src="${contentData.url}" alt="image-message">`;
                break;
            // ▲▲▲ 修正结束 ▲▲▲
            case 'image':
                contentDiv.className = 'content image-text-content';
                contentDiv.innerHTML = `
                    <div class="image-text-cover"><img src="https://i.postimg.cc/RF2kGBvN/A0-E8-A59-DE8-E7368-B0824-AA62553191-E8.jpg" style="width: 100%; height: 100%; object-fit: cover;"></div>
                    <div class="image-text-details" style="display: none;">${contentData.text.replace(/\n/g, '<br>')}</div>
                `;
                break;
        }
    }

    bubble.appendChild(contentDiv);
    
    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    
    if (senderClass === 'ai' && chat.isBlocked) {
        const failedIndicator = document.createElement('div');
        failedIndicator.className = 'message-failed-indicator';
        failedIndicator.textContent = '!';
        failedIndicator.title = '消息发送失败';
        wrapper.appendChild(failedIndicator);
    }

    addInteractionHandlers(wrapper, message);
    
    messagesDiv.appendChild(wrapper);
    wrapper.classList.add('message-appear-animation');

    if (appState.isMultiSelectMode) {
        const indicator = document.createElement('div');
        indicator.className = 'message-selection-indicator';
        wrapper.prepend(indicator);
    }
    // ▲▲▲ 新增結束 ▲▲▲

    if (replyTo && replyTo.timestamp) {
        const quoteContainer = document.createElement('div');
        quoteContainer.className = `quote-reply-container ${senderClass}`;
        const quoteBox = document.createElement('div');
        quoteBox.className = 'quote-reply-box';
        let quoteAuthorName = '';
        if (replyTo.role === 'user') {
            quoteAuthorName = chat.personas.my.name;
        } else {
            const persona = (chat.type === 'group' ? chat.personas.ai.find(p => p.name === replyTo.author) : chat.personas.ai) || {};
            quoteAuthorName = persona.name || 'AI';
        }
        quoteBox.textContent = `${quoteAuthorName}: ${summarizeLastMessage(replyTo)}`;
        quoteContainer.appendChild(quoteBox);
        messagesDiv.appendChild(quoteContainer);
        quoteContainer.classList.add('message-appear-animation');
    }
    
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
};

    const appendSystemMessageToChat = async (textOrObject) => {
        const chat = appState.chats[appState.activeChatId];
        if (!chat) return;

        const timestamp = Date.now();
        const contentObject = (typeof textOrObject === 'object' && textOrObject !== null) ? textOrObject : { content: textOrObject };
        
        const historyEntry = {
            role: 'system',
            ...contentObject,
            timestamp: timestamp
        };

        appendMessage(historyEntry);
        chat.history.push(historyEntry);
        
        await dbStorage.set(KEYS.CHATS, appState.chats);
    };

    const checkAndInsertTimestamp = async () => {
        const chat = appState.chats[appState.activeChatId];
        if (!chat || !chat.history || chat.history.length === 0) return;
        const lastMessage = chat.history[chat.history.length - 1];
        const threeMinutes = 3 * 60 * 1000;
        if (lastMessage && (Date.now() - lastMessage.timestamp > threeMinutes) && lastMessage.role !== 'system') {
            const timeString = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
            await appendSystemMessageToChat(timeString);
        }
    };
    const summarizeLastMessage = (lastMsg) => {
        if (!lastMsg) return ' ';
        const content = lastMsg.content;
        if (typeof content === 'string') return content;
        if (typeof content === 'object' && content !== null) {
            switch (content.type) {
                case 'user_poke': return content.text; // 【新增这一行】
                case 'voice': case 'send_voice': return '[语音讯息]';
                case 'image': return '[图片]';
                case 'vision': return content.text ? `[图片] ${content.text}` : '[图片]';
                case 'send_image_url': return content.caption || '[图片]';
                case 'location': return `[位置] ${content.address}`;
                case 'transfer': case 'send_transfer': return '[转帐]';
                case 'moment_post': return `[朋友圈] ${content.text}`;
                case 'call_log': return content.content;
                case 'retraction': return content.content;
                default:
                    if (lastMsg.role === 'system' && content.content) return content.content;
                    return '[訊息]';
            }
        }
        return ' ';
    };

const showContextMenu = (message, element) => {
    const menu = document.getElementById('message-context-menu');
    appState.activeContextMenu = { message, element };    
    document.getElementById('context-menu-view').onclick = (event) => { 
        event.stopPropagation(); // 阻止事件继续传播
        handleViewAction(message); 
        hideContextMenu(); 
    };

document.getElementById('context-menu-multiselect').onclick = (event) => { 
        event.stopPropagation();
        enterMultiSelectMode(message); // 觸發進入多選模式
        hideContextMenu(); 
    };

    document.getElementById('context-menu-quote').onclick = (event) => { 
        event.stopPropagation(); // 阻止事件继续传播
        startReplying(message); 
        hideContextMenu(); 
    };
    document.getElementById('context-menu-copy').onclick = (event) => { 
        event.stopPropagation(); // 阻止事件继续传播
        copyMessageContent(message); 
        hideContextMenu(); 
    };
    document.getElementById('context-menu-delete').onclick = (event) => { 
        event.stopPropagation(); // 阻止事件继续传播
        deleteMessage(message.timestamp); 
        hideContextMenu(); 
    };
    
    const editBtn = document.getElementById('context-menu-edit');
    const regenerateBtn = document.getElementById('context-menu-regenerate');

// 1. 设置“编辑”按钮
if (typeof message.content === 'string') {
    editBtn.style.display = 'block';
    editBtn.onclick = (event) => {
        event.stopPropagation(); // 阻止事件继续传播
        startInlineEdit(message, element); // <--- 修改这里，调用我们的新函数
        hideContextMenu(); 
    };

    } else {
        editBtn.style.display = 'none';
        editBtn.onclick = null;
    }

    // 2. 设置“重置”按钮
    if (message.role === 'assistant') {
        regenerateBtn.style.display = 'block';
        regenerateBtn.onclick = (event) => {
            event.stopPropagation(); // 阻止事件继续传播
            handleRegenerateAction(message); 
            hideContextMenu(); 
        };
    } else {
        regenerateBtn.style.display = 'none';
        regenerateBtn.onclick = null;
    }

    // --- 定位菜单的逻辑（不变） ---
    const rect = element.getBoundingClientRect();
    const phoneScreenRect = document.getElementById('phone-screen').getBoundingClientRect();
    let top = rect.top - phoneScreenRect.top - menu.offsetHeight - 10;
    let left = rect.left - phoneScreenRect.left;
    if (top < 10) { top = rect.bottom - phoneScreenRect.top + 10; }
    if (left + menu.offsetWidth > phoneScreenRect.width - 10) { left = rect.right - phoneScreenRect.left - menu.offsetWidth; }
    if (left < 10) { left = 10; }
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menu.classList.add('visible');
};
// ▲▲▲ 替换到此结束 ▲▲▲

const hideContextMenu = () => {
    const menu = document.getElementById('message-context-menu');
    if (menu) menu.classList.remove('visible');
    appState.activeContextMenu = null;
};

const copyMessageContent = (message) => {
    let contentToCopy = '';
    if (typeof message.content === 'string') {
        contentToCopy = message.content;
    } else if (typeof message.content === 'object' && message.content !== null) {
        contentToCopy = message.content.text || `[${message.content.type || '特殊消息'}]`;
    }
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(contentToCopy).then(() => {
            // 可以选择性地显示一个“已复制”的提示
        }).catch(err => console.error('复制失败', err));
    }
};

const startReplying = (message) => {
    appState.replyingToMessage = message;
    const previewBar = document.getElementById('reply-preview-bar');
    const previewContainer = document.getElementById('reply-preview-container');
    const authorSpan = previewBar.querySelector('.reply-to-author');
    const textSpan = previewBar.querySelector('.reply-to-text');

    // 查找发言人名称
    let authorName = '';
    const chat = appState.chats[appState.activeChatId];
    if (message.role === 'user') {
        authorName = chat.personas.my.name;
    } else { // assistant
        const persona = chat.type === 'group' 
            ? chat.personas.ai.find(p => p.name === message.author) 
            : chat.personas.ai;
        authorName = persona?.name || 'AI';
    }

    authorSpan.textContent = `回复 ${authorName}:`;
    textSpan.textContent = summarizeLastMessage(message);

    // 将预览条添加到容器并显示
    previewContainer.appendChild(previewBar);
    previewBar.style.display = 'flex';
    document.getElementById('chat-input').focus();
};

const cancelReplying = () => {
    appState.replyingToMessage = null;
    const previewBar = document.getElementById('reply-preview-bar');
    if (previewBar) {
        previewBar.style.display = 'none';
    }
};

const renderChatList = () => {
    const container = document.getElementById('chat-list-container');
    container.innerHTML = '';
    const isEditMode = appState.editMode.chat;
    const chatIds = Object.keys(appState.chats);
    const editBtn = document.getElementById('main-hub-edit-btn');

    if (chatIds.length === 0) {
        if(editBtn) editBtn.style.display = 'none';
        container.innerHTML = `<p style="text-align:center; color:#8a8a8a; margin-top: 40px;">點擊右上角“+”來創建第一個對話吧！</p>`;
        return;
    }
    if(editBtn) editBtn.style.display = 'block';

    chatIds.sort((a, b) => {
        const chatA = appState.chats[a];
        const chatB = appState.chats[b];
        if (chatA.pinned && !chatB.pinned) return -1;
        if (!chatA.pinned && chatB.pinned) return 1;
        const timeA = chatA.history.slice(-1)[0]?.timestamp || 0;
        const timeB = chatB.history.slice(-1)[0]?.timestamp || 0;
        return timeB - timeA;
    });

    chatIds.forEach(chatId => {
        const chatData = appState.chats[chatId];
        const item = document.createElement('div');
        item.className = 'list-item';

        if (chatData.pinned) {
            item.style.backgroundColor = 'var(--body-bg)';
        }
        if (isEditMode) item.classList.add('edit-mode');

        const content = document.createElement('div');
        content.className = 'list-item-content';
        content.addEventListener('click', () => { if (!isEditMode) openChat(chatId); });

        // ▼▼▼ 核心修改开始 ▼▼▼
        let avatarElement;

        if (chatData.type === 'group') {
    // 如果是群聊，创建一个九宫格容器
    avatarElement = document.createElement('div');
    avatarElement.className = 'group-avatar-container';

    // 【核心修复】在调用 .slice() 前，先检查 chatData.personas.ai 是否为数组
    const membersToDisplay = Array.isArray(chatData.personas.ai) 
        ? chatData.personas.ai.slice(0, 9) 
        : []; // 如果不是数组，则返回一个空数组，避免程式崩溃

    membersToDisplay.forEach(member => {
        const memberAvatar = document.createElement('img');
        memberAvatar.className = 'member-avatar';
        memberAvatar.src = member.avatar || DEFAULT_AVATAR;
        avatarElement.appendChild(memberAvatar);
    });

        } else {
            // 如果是单人聊天，保持原来的逻辑
            avatarElement = document.createElement('img');
            avatarElement.className = 'list-item-avatar';
            const aiPersona = Array.isArray(chatData.personas.ai) ? chatData.personas.ai[0] : chatData.personas.ai;
            avatarElement.src = aiPersona?.avatar || DEFAULT_AVATAR;
        }
        // ▲▲▲ 核心修改结束 ▲▲▲

        const info = document.createElement('div');
        info.className = 'list-item-info';

        const name = document.createElement('span');
        name.className = 'list-item-name';
        name.textContent = chatData.name;

        const lastMessage = document.createElement('span');
        lastMessage.className = 'list-item-last-message';
        const lastMessageObj = chatData.history.slice(-1)[0];
        lastMessage.textContent = summarizeLastMessage(lastMessageObj);

        info.appendChild(name);
        info.appendChild(lastMessage);
        
        // ▼▼▼ 将修改后的 avatarElement 添加到内容中 ▼▼▼
        content.appendChild(avatarElement); 
        content.appendChild(info);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-button';
        deleteBtn.textContent = '－';
        deleteBtn.addEventListener('click', async (e) => { e.stopPropagation(); await deleteChat(chatId, item); });

        item.appendChild(deleteBtn);
        item.appendChild(content);
        container.appendChild(item);
    });
};

    const renderPersonaList = (type) => {
        const container = document.getElementById(`${type}-persona-list-container`);
        const editBtn = document.getElementById(`${type}-persona-edit-btn`);
        const isEditMode = appState.editMode[`${type}_persona`];
        container.innerHTML = '';
        const presets = appState.personas[type];
        if (presets.length === 0) {
            if (editBtn) editBtn.style.display = 'none';
            container.innerHTML = `<p style="text-align:center; color:#8a8a8a; margin-top: 40px;">點擊右上角“+”來創建第一個預設吧！</p>`;
            return;
        }
        if(editBtn) editBtn.style.display = 'block';
        presets.forEach((preset, index) => {
            const item = document.createElement('div');
            item.className = 'list-item';
            if (isEditMode) item.classList.add('edit-mode');
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-button';
            deleteBtn.textContent = '－';
            deleteBtn.addEventListener('click', async (e) => { e.stopPropagation(); await deletePersonaPreset(type, index, item); });
            const content = document.createElement('div');
            content.className = 'list-item-content';

            // --- 修正部分開始 ---
            const avatar = document.createElement('img');
            avatar.className = 'list-item-avatar';
            avatar.src = preset.avatar || DEFAULT_AVATAR; // 修正：使用正確的 preset 物件

            const name = document.createElement('span');
            name.className = 'list-item-name';
            name.textContent = preset.name; // 修正：使用正確的 preset 物件
            
            content.appendChild(avatar);
            content.appendChild(name);
            // --- 修正部分結束 ---

            content.addEventListener('click', () => { if (!isEditMode) openPersonaEditor(type, index); });
            item.appendChild(deleteBtn);
            item.appendChild(content);
            container.appendChild(item);
        });
    };

// --- 新增：从通讯录发起或打开聊天的功能 ---
const startChatFromContacts = async (contact) => {
    // 1. 检查一个与该AI的1对1聊天是否已经存在
    let existingChatId = null;
    for (const chatId in appState.chats) {
        const chat = appState.chats[chatId];
        // 查找条件：必须是单人聊天，且AI角色的名字要匹配
        if (chat.type === 'single' && chat.personas.ai.name === contact.name) {
            existingChatId = chatId;
            break;
        }
    }


    if (existingChatId) {
        console.log(`找到与 ${contact.name} 的现有聊天，正在打开...`);
        openChat(existingChatId);
    } else {
     
        console.log(`未找到与 ${contact.name} 的聊天。正在创建新聊天...`);
        const myPersona = appState.personas.my[0]; // 获取用户的默认角色
        if (!myPersona) {
            alert('错误：请先在“我的素材库”中创建您自己的角色！');
            return;
        }

        const newChatId = 'chat_' + Date.now();
        appState.chats[newChatId] = {
            name: contact.name,
            type: 'single',
            history: [],
            pinned: true, // 关键：新建的聊天自动置顶
            personas: {
                ai: contact,
                my: myPersona
            },
            wallpaper: null,
            memoryRounds: 0,
            isOfflineMode: false
        };
        await dbStorage.set(KEYS.CHATS, appState.chats);
        openChat(newChatId); // 打开新建的聊天
    }

    switchTab('chat');
};

const renderContactsList = () => {
    const container = document.getElementById('contacts-list-container');
    container.innerHTML = '';

   
    const publicAccountListItem = document.createElement('div');
    publicAccountListItem.className = 'list-item';
    publicAccountListItem.style.cursor = 'pointer';

   
    const publicAccountContact = {
        name: '公众号',
       
        avatar: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzQ2ODJlZiIvPjwvc3ZnPg==',
        content: '这是一个官方公众号。' 
    };

publicAccountListItem.onclick = () => {
    appState.hasNewPublicPosts = false; 
  
    renderPublicAccountFeed(); 
    showScreen('public-account-screen');
};

   
    const content = document.createElement('div');
    content.className = 'list-item-content';
    content.style.justifyContent = 'flex-start';
    content.style.gap = '15px';
    const avatar = document.createElement('img');
    avatar.src = publicAccountContact.avatar; 
    avatar.style.width = '40px';
    avatar.style.height = '40px';
    avatar.style.borderRadius = '5px';
    const name = document.createElement('span');
    name.className = 'list-item-name';
    name.textContent = publicAccountContact.name; 
    content.appendChild(avatar);
    content.appendChild(name);
    if (appState.hasNewPublicPosts) {
    const redDot = document.createElement('span');
    redDot.style.cssText = `
        width: 8px; 
        height: 8px; 
        background-color: #ff3b30; 
        border-radius: 50%;
        position: absolute;
        right: 15px; /* 调整红点位置 */
        top: 15px;  /* 调整红点位置 */
    `;
    content.appendChild(redDot); // 把红点加到内容里
}

// ...后面拼接头像和名字的代码...
publicAccountListItem.append(content);

    // 5. 将创建好的公众号列表项添加到通讯录容器的顶部
    container.appendChild(publicAccountListItem);

    // ▲▲▲ 新增代码结束 ▲▲▲

    // --- 以下是原有的、渲染普通联系人的逻辑，保持不变 ---
    const contacts = appState.contacts;
    if (contacts.length === 0 && !container.hasChildNodes()) { // 修正判断条件，如果已有公众号则不显示此消息
        container.innerHTML = `<p style="text-align:center; color:#8a8a8a; margin-top: 40px;">点击右上角“+”号并选择“添加联系人”</p>`;
        return;
    }
    contacts.forEach((contact) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.style.cursor = 'pointer';
        item.onclick = () => startChatFromContacts(contact);

        const content = document.createElement('div');
        content.className = 'list-item-content';
        content.style.justifyContent = 'flex-start';
        content.style.gap = '15px';
        const avatar = document.createElement('img');
        avatar.src = contact.avatar || DEFAULT_AVATAR;
        avatar.style.width = '40px';
        avatar.style.height = '40px';
        avatar.style.borderRadius = '5px';
        const name = document.createElement('span');
        name.className = 'list-item-name';
        name.textContent = contact.name;
        content.appendChild(avatar);
        content.appendChild(name);
        item.append(content);
        container.appendChild(item);
    });
};

    const deleteChat = async (chatId, itemElement) => {
        const chatName = appState.chats[chatId]?.name;
        if (!chatName) return;
        showCustomConfirm('删除对话', `您确定要删除对话 <b>"${chatName}"</b> 吗?<br>此操作无法复原。`, async () => {
            delete appState.chats[chatId];
            if (appState.activeChatId === chatId) appState.activeChatId = null;
            await dbStorage.set(KEYS.CHATS, appState.chats);
            animateAndRemoveItem(itemElement, () => renderChatList());
        });
    };

// 【新增】拉黑联系人的核心功能
const blockContact = async (chatId) => {
    const chat = appState.chats[chatId];
    if (!chat || chat.type !== 'single') {
        alert('错误：只能拉黑单人对话的联系人。');
        return;
    }

    const contactName = chat.personas.ai.name;

    // 1. 弹出确认框
    showCustomConfirm(
        '拉黑联系人',
        `您确定要拉黑 <b>"${contactName}"</b> 吗？<br><br>拉黑后，对方将无法正常与您通讯。`,
        async () => {
            // 2. 标记该聊天为“已拉黑”
            chat.isBlocked = true;

            // 3. 在AI的人设中追加一条规则，让它知道自己被拉黑了
            const blockInstruction = "\n\n[重要系统指令：你已被对方拉黑。你发送的所有消息都将失败。请在回复中体现出消息发送失败后的困惑、尝试或无奈。]";
            chat.personas.ai.content += blockInstruction;

            // 4. 在聊天记录中添加一条隐藏的系统消息，作为触发AI回应的上下文
            const hiddenSystemMessage = {
                role: 'system',
                content: '[系统事件：对方已将你拉黑。]',
                hidden: true,
                timestamp: Date.now()
            };
            chat.history.push(hiddenSystemMessage);

            // 5. 保存所有更改到数据库
            await dbStorage.set(KEYS.CHATS, appState.chats);
            console.log(`联系人 "${contactName}" 已被拉黑。`);

            // 6. 切换回聊天界面并触发AI的回应
            showScreen('chat-screen');
            await receiveMessageHandler();
        }
    );
};

// 【新增】解除拉黑的核心功能
const unblockContact = async (chatId) => {
    const chat = appState.chats[chatId];
    if (!chat) return;

    // 1. 移除 isBlocked 标记
    delete chat.isBlocked;

    // 2. 从 AI 的核心设定中，移除那条关于被拉黑的指令
    //    【重要】这里的字符串必须和 blockContact 函数里添加的完全一致才能被替换掉
    const blockInstruction = "\n\n[重要系统指令：你已被对方拉黑。你发送的所有消息都将失败。请在回复中体现出消息发送失败后的困惑、尝试或无奈。]";
    chat.personas.ai.content = chat.personas.ai.content.replace(blockInstruction, ""); // 替换为空字符串，即删除

    // 3. 在聊天记录中添加一条隐藏的系统消息，通知 AI
    const hiddenSystemMessage = {
        role: 'system',
        content: '[系统事件：对方已将你解除拉黑。]',
        hidden: true,
        timestamp: Date.now()
    };
    chat.history.push(hiddenSystemMessage);

    // 4. 保存更改到数据库
    await dbStorage.set(KEYS.CHATS, appState.chats);
    console.log(`联系人 "${chat.personas.ai.name}" 已被解除拉黑。`);

    // 5. 提示用户并返回聊天界面，然后触发 AI 的回应
    alert('解除拉黑成功！');
    showScreen('chat-screen');
    await receiveMessageHandler();
};

const deleteContact = async (chatId) => {
    const chat = appState.chats[chatId];
    if (!chat || chat.type !== 'single') {
        alert('错误：只能删除单人对话的联系人。');
        return;
    }

    const contactName = chat.personas.ai.name;

    showCustomConfirm(
        '删除联系人',
        `您确定要删除联系人 <b>"${contactName}"</b> 吗？<br><br>此操作将：<br>1. 删除这个对话框。<br>2. 从您的通讯录中移除此人。<br><br><b>此操作无法复原。</b>`,
        async () => {
            // 1. 从通讯录列表中删除
            appState.contacts = appState.contacts.filter(contact => contact.name !== contactName);
            await dbStorage.set(KEYS.CONTACTS, appState.contacts);
            console.log(`联系人 "${contactName}" 已从通讯录删除。`);

            // 2. 从对话列表中删除
            delete appState.chats[chatId];
            if (appState.activeChatId === chatId) {
                appState.activeChatId = null;
            }
            await dbStorage.set(KEYS.CHATS, appState.chats);
            console.log(`与 "${contactName}" 的对话已删除。`);

            // 3. 操作完成后，返回到主界面并切换到通讯录标签页
            alert(`联系人 "${contactName}" 已被彻底删除。`);
            switchTab('contacts'); // 切换到通讯录，让用户看到变化
            showScreen('main-hub-screen');
        }
    );
};

    const deletePersonaPreset = async (type, index, itemElement) => {
        const presetName = appState.personas[type][index]?.name;
        if (!presetName) return;
        showCustomConfirm('删除预设', `您确定要删除预设 <b>"${presetName}"</b> 吗?`, async () => {
            appState.personas[type].splice(index, 1);
            const key = type === 'ai' ? KEYS.PERSONA_AI : KEYS.PERSONA_MY;
            await dbStorage.set(key, appState.personas[type]);
            animateAndRemoveItem(itemElement, () => renderPersonaList(type));
        });
    };
    

// ▼▼▼ 从这里开始，是新增的提示词功能JS逻辑 ▼▼▼

// 渲染提示词列表
const renderPromptList = () => {
    const container = document.getElementById('prompt-list-container');
    container.innerHTML = '';
    const isEditMode = appState.editMode.prompt; // 我们将使用一个新的编辑模式状态
    const editBtn = document.getElementById('prompt-edit-btn');

    if (appState.prompts.length === 0) {
        if(editBtn) editBtn.style.display = 'none';
        container.innerHTML = `<p style="text-align:center; color:#8a8a8a; margin-top: 40px;">点击右上角“+”来创建第一个提示词吧！</p>`;
        return;
    }
    if(editBtn) editBtn.style.display = 'block';

    appState.prompts.forEach((prompt, index) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        if (isEditMode) item.classList.add('edit-mode');

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-button';
        deleteBtn.textContent = '－';
        deleteBtn.onclick = (e) => { e.stopPropagation(); deletePrompt(index, item); };

        const content = document.createElement('div');
        content.className = 'list-item-content';
        // 提示词没有头像，所以我们只显示标题和内容预览
        content.innerHTML = `
            <div class="list-item-info">
                <span class="list-item-name">${prompt.title}</span>
                <span class="list-item-last-message">${prompt.content.substring(0, 30)}...</span>
            </div>
        `;
        content.onclick = () => { if (!isEditMode) openPromptEditor(index); };
        
        item.appendChild(deleteBtn);
        item.appendChild(content);
        container.appendChild(item);
    });
};

// 打开提示词编辑器 (新增或编辑)
const openPromptEditor = (index = -1) => {
    appState.editingPromptIndex = index;
    const titleInput = document.getElementById('prompt-title-input');
    const contentInput = document.getElementById('prompt-content-input');
    const title = document.getElementById('prompt-editor-title');

    if (index === -1) { // 新增
        title.textContent = '新增提示词';
        titleInput.value = '';
        contentInput.value = '';
    } else { // 编辑
        const prompt = appState.prompts[index];
        title.textContent = '编辑提示词';
        titleInput.value = prompt.title;
        contentInput.value = prompt.content;
    }
    showScreen('prompt-editor-screen');
};

// 删除提示词
const deletePrompt = async (index, itemElement) => {
    const promptTitle = appState.prompts[index]?.title;
    if (!promptTitle) return;
    showCustomConfirm('删除提示词', `您确定要删除提示词 <b>"${promptTitle}"</b> 吗?`, async () => {
        appState.prompts.splice(index, 1);
        await dbStorage.set(KEYS.PROMPTS, appState.prompts);
        animateAndRemoveItem(itemElement, renderPromptList);
    });
};

// ▲▲▲ 新增JS逻辑结束 ▲▲▲

const openPromptSelectionModal = () => {
    const chat = appState.chats[appState.activeChatId];
    if (!chat) return;

    const modalTitle = document.getElementById('persona-selection-modal-title');
    const modalList = document.getElementById('modal-persona-list');
    
    modalTitle.textContent = '选择提示词';
    modalList.innerHTML = '';

    const selectedIds = new Set(chat.promptIds || []);

    appState.prompts.forEach((prompt) => {
        const item = document.createElement('div');
        item.className = 'persona-checkbox-item';
        
        const isChecked = selectedIds.has(prompt.id);

        item.innerHTML = `
            <input type="checkbox" id="prompt-checkbox-${prompt.id}" value="${prompt.id}" ${isChecked ? 'checked' : ''}>
            <div class="list-item-info" style="cursor: pointer;">
                <label for="prompt-checkbox-${prompt.id}" class="list-item-name" style="cursor: pointer;">${prompt.title}</label>
                <label for="prompt-checkbox-${prompt.id}" class="list-item-last-message" style="cursor: pointer; white-space: normal;">${prompt.content.substring(0, 40)}...</label>
            </div>
        `;
        modalList.appendChild(item);
    });

    // 绑定事件
    document.getElementById('save-selection-btn').onclick = savePromptSelection; // 注意这里没有 ()
    document.getElementById('cancel-selection-btn').onclick = closePersonaSelectionModal;

    document.getElementById('persona-selection-modal').classList.add('active');
};


const selectPrompt = (prompt) => {
    const chat = appState.chats[appState.activeChatId];
    const selectionText = document.getElementById('chat-prompt-selection-text');
    if (prompt) {
        chat.promptId = prompt.id;
        selectionText.textContent = prompt.title;
        selectionText.classList.remove('placeholder');
    } else {
        delete chat.promptId; // 清除自定义提示词ID
        selectionText.textContent = '默认 (基于AI人设)';
        selectionText.classList.add('placeholder');
    }
    closePersonaSelectionModal(); // 复用关闭模态框的函数
};

const openCreateGroupChatScreen = () => {
    // 清空旧的输入和选择
    document.getElementById('group-chat-name-input').value = '';
    const myPersonaText = document.getElementById('group-my-persona-selection-text');
    myPersonaText.textContent = '从我的素材库选择';
    myPersonaText.classList.add('placeholder');
    appState.newChatTempPersonas = { ai: null, my: null };

    // 动态生成 AI 成员选择列表
    const container = document.getElementById('group-ai-persona-list-container');
    container.innerHTML = '';

    // 【核心修复】在调用 .forEach() 前，先检查 appState.personas.ai 是否为一个数组
    if (Array.isArray(appState.personas.ai)) {
        appState.personas.ai.forEach(persona => {
            const item = document.createElement('div');
            item.className = 'persona-checkbox-item';
            item.innerHTML = `
                <input type="checkbox" id="persona-checkbox-${persona.name}" value="${persona.name}">
                <img src="${persona.avatar || DEFAULT_AVATAR}" class="list-item-avatar">
                <label for="persona-checkbox-${persona.name}" class="list-item-name">${persona.name}</label>
            `;
            container.appendChild(item);
        });
    } else {
        // 如果数据有问题，可以在控制台打印一条错误信息，方便调试
        console.error("无法生成群聊成员列表，因为 appState.personas.ai 不是一个数组。");
    }
    
    showScreen('create-group-chat-screen');
};

// ▼▼▼ 粘贴这一整块新增的 JS 函数到您的 <script> 标签内 ▼▼▼

// 打开“添加歌曲”弹窗
const openAddSongModal = () => {
    // 清空输入框
    document.getElementById('add-song-title-input').value = '';
    document.getElementById('add-song-artist-input').value = '';
    document.getElementById('add-song-url-input').value = '';
    document.getElementById('add-song-art-input').value = '';
    
    // 显示弹窗
    document.getElementById('add-song-modal').classList.add('active');
};

// 关闭“添加歌曲”弹窗
const closeAddSongModal = () => {
    document.getElementById('add-song-modal').classList.remove('active');
};

// 保存用户输入的新歌曲
const saveNewSong = async () => {
    const title = document.getElementById('add-song-title-input').value.trim();
    const artist = document.getElementById('add-song-artist-input').value.trim();
    const url = document.getElementById('add-song-url-input').value.trim();
    const art = document.getElementById('add-song-art-input').value.trim();

    if (!title || !artist || !url) {
        alert('歌曲名、歌手和歌曲 URL 不能为空！');
        return;
    }

    const newTrack = {
        title,
        artist,
        url,
        art: art || null, // 如果封面URL为空，则存为 null
        lyrics: "[00:00.00]暂无歌词" // 默认歌词
    };

    // 将新歌曲添加到播放列表
    appState.playlist.push(newTrack);
    
    // 如果这是随机播放模式，则重新生成洗牌列表
    if (appState.playbackMode === 'shuffle') {
        generateShuffledPlaylist();
    }
    
    // 保存到数据库
    await dbStorage.set(KEYS.PLAYLIST, appState.playlist);
    
    // 如果这是播放列表中的第一首歌，则直接加载并播放
    if (appState.currentTrackIndex === -1) {
        loadTrack(appState.playlist.length - 1);
    }
    
    // 刷新播放列表弹窗的内容
    renderPlaylist();
    
    alert(`歌曲《${title}》已成功添加！`);
    closeAddSongModal();
};

// 处理进度条拖动事件
const seekProgress = () => {
    const player = document.getElementById('global-audio-player');
    const progressBar = document.getElementById('player-progress-bar');
    
    if (player.duration) {
        // 计算新的播放时间
        const seekTime = (progressBar.value / 100) * player.duration;
        player.currentTime = seekTime;
    }
};

// ▲▲▲ 新增函数粘贴到此结束 ▲▲



const MESSAGES_PER_PAGE = 60; 
const MOMENTS_PER_PAGE = 10; // <-- 这是您需要新增的那一行

const openChat = (chatId) => {
    if (appState.editMode.chat) return;
    const chat = appState.chats[chatId];
    if (!chat) { showScreen('main-hub-screen'); return; }

    appState.activeChatId = chatId;
    document.getElementById('chat-title').textContent = chat.name;
    
    const messagesDiv = document.getElementById('chat-messages');
    messagesDiv.innerHTML = ''; 

    cancelReplying();
    closePanel();

    updateChatScreenVisuals(chat.isOfflineMode);

    let lastStatus = null;
    if (chat.history) {
        for (let i = chat.history.length - 1; i >= 0; i--) {
            const msg = chat.history[i];
            if (msg.role === 'system' && msg.content?.type === 'status_update') {
                lastStatus = msg.content.status; break;
            }
        }
    }
    updateStatusBubble(lastStatus); 

    messagesDiv.style.backgroundImage = chat.wallpaper ? `url(${chat.wallpaper})` : 'none';
// ▼▼▼ 在这里添加下面这行代码 ▼▼▼
messagesDiv.style.backgroundColor = chat.wallpaper ? 'transparent' : '';

    // 【核心改造】
    if (chat.history && chat.history.length > 0) {
        // 1. 计算要显示的最近消息的起始索引
        const totalMessages = chat.history.length;
        const startIndex = Math.max(0, totalMessages - MESSAGES_PER_PAGE);
        // 在 appState 中记录我们这次加载到了哪里，方便下次继续
        appState.currentChatRenderIndex = startIndex; 

        // 2. 如果还有更早的消息未加载，就在顶部显示“加载更多”按钮
        if (startIndex > 0) {
            const loadMoreBtn = document.createElement('div');
            loadMoreBtn.textContent = '加载更早的消息';
            loadMoreBtn.style.cssText = `
                text-align: center; 
                padding: 10px; 
                color: var(--system-message-color); 
                font-size: 13px; 
                cursor: pointer;
                background-color: #e8e8e8;
                border-radius: 8px;
                margin: 5px auto 15px auto;
                width: fit-content;
            `;
            loadMoreBtn.id = 'load-more-btn';
            loadMoreBtn.onclick = loadMoreMessages; // 点击时调用我们下一步要创建的函数
            messagesDiv.appendChild(loadMoreBtn);
        }

        // 3. 只渲染最近的一批消息
        const messagesToRender = chat.history.slice(startIndex);
        messagesToRender.forEach(msg => {
            if (!msg.hidden) { 
                appendMessage(msg); 
            }
        });

        // 4. 滚动到底部
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
    
    showScreen('chat-screen');
};
// ▲▲▲ 替换结束 ▲▲▲

// ▼▼▼ 使用这个【最终修正版】，完整替换旧的 loadMoreMessages 函数 ▼▼▼
const loadMoreMessages = async () => {
    const chat = appState.chats[appState.activeChatId];
    const messagesDiv = document.getElementById('chat-messages');
    let loadMoreBtn = document.getElementById('load-more-btn'); // 获取当前的按钮

    if (!chat || appState.currentChatRenderIndex <= 0) {
        if (loadMoreBtn) loadMoreBtn.remove();
        return;
    }

    // 【核心修正 1】: 在加载新消息前，先将旧的按钮从 DOM 中移除
    if (loadMoreBtn) {
        loadMoreBtn.remove();
    }

    // (这部分逻辑不变) 保存当前的滚动条高度，以防止页面跳动
    const oldScrollHeight = messagesDiv.scrollHeight;

    // (这部分逻辑不变) 计算要加载的消息范围
    const endIndex = appState.currentChatRenderIndex;
    const startIndex = Math.max(0, endIndex - MESSAGES_PER_PAGE);
    const messagesToPrepend = chat.history.slice(startIndex, endIndex);

    // (这部分逻辑不变) 倒序循环，将旧消息一条条插入到顶部
    for (let i = messagesToPrepend.length - 1; i >= 0; i--) {
        const msg = messagesToPrepend[i];
        if (!msg.hidden) {
            prependMessage(msg, messagesDiv);
        }
    }

    // (这部分逻辑不变) 恢复滚动条位置
    const newScrollHeight = messagesDiv.scrollHeight;
    messagesDiv.scrollTop = newScrollHeight - oldScrollHeight;

    // (这部分逻辑不变) 更新下一次加载的起始点
    appState.currentChatRenderIndex = startIndex;

    // 【核心修正 2】: 如果检查后发现还有更早的消息，就重新创建一个新的按钮并插入到最顶部
    if (startIndex > 0) {
        const newLoadMoreBtn = document.createElement('div');
        newLoadMoreBtn.textContent = '加载更早的消息';
        // (按钮的样式和 ID 保持不变)
        newLoadMoreBtn.style.cssText = `
            text-align: center; 
            padding: 10px; 
            color: var(--system-message-color); 
            font-size: 13px; 
            cursor: pointer;
            background-color: #e8e8e8;
            border-radius: 8px;
            margin: 5px auto 15px auto;
            width: fit-content;
        `;
        newLoadMoreBtn.id = 'load-more-btn';
        newLoadMoreBtn.onclick = loadMoreMessages; // 为新按钮绑定点击事件
        
        messagesDiv.prepend(newLoadMoreBtn); // 将新按钮插入到所有消息的最前面
    }
};
// ▲▲▲ 替换到此结束 ▲▲▲

const showPersonaList = (type) => { 
    appState.currentPersonaType = type; 
    renderPersonaList(type); 
    showScreen(`${type}-persona-list-screen`); 
};

    
    const openPersonaEditor = (type, index = -1) => {
    if (appState.editMode[`${type}_persona`]) return;
    appState.currentPersonaType = type; 
    appState.editingPresetIndex = index;
    const nameInput = document.getElementById('preset-name-input');
    const avatarPreview = document.getElementById('preset-avatar-preview');
    const contentInput = document.getElementById('preset-content-input');
    const title = document.getElementById('persona-editor-title');

    const startChatBtn = document.getElementById('start-chat-from-editor-btn');
    // ▼▼▼ 新增：获取“设为主要”按钮 ▼▼▼
    const primaryBtn = document.getElementById('set-primary-persona-btn');

    if (type === 'ai' && index > -1) {
        startChatBtn.style.display = 'block';
    } else {
        startChatBtn.style.display = 'none';
    }

    // ▼▼▼ 新增：控制“设为主要”按钮的显示/隐藏 ▼▼▼
    // 只有在编辑一个已存在的、且不是第一个的“我的面具”时，才显示此按钮
    if (type === 'my' && index > 0) {
        primaryBtn.style.display = 'block';
    } else {
        primaryBtn.style.display = 'none';
    }
    // ▲▲▲ 新增逻辑结束 ▲▲▲

    if (index === -1) { 
        title.textContent = '新增預設'; 
        nameInput.value = ''; 
        avatarPreview.src = DEFAULT_AVATAR; 
        contentInput.value = ''; 
    } else { 
        const preset = appState.personas[type][index]; 
        title.textContent = '編輯預設'; 
        nameInput.value = preset.name; 
        avatarPreview.src = preset.avatar || DEFAULT_AVATAR; 
        contentInput.value = preset.content; 
    }
    showScreen('persona-editor-screen');
};

    const openPersonaSelectionModal = (context) => {
    appState.personaSelectionContext = context;
    let presets = [];
    const modalList = document.getElementById('modal-persona-list');
    modalList.innerHTML = '';

    if (context === 'add_contact') {
        presets = appState.personas.ai.filter(p =>
            !appState.contacts.some(c => c.name === p.name)
        );
    } else {
        const type = context.includes('ai') ? 'ai' : 'my';
        presets = appState.personas[type];
    }

    if (presets.length === 0) {
        const message = context === 'add_contact'
            ? '所有 AI 人设都已是您的联系人。'
            : '没有可選的預設。';
        modalList.innerHTML = `<p style="text-align:center; color:#8a8a8a; padding: 20px;">${message}</p>`;
    } else {
        presets.forEach((preset) => {
            const item = document.createElement('div');
            item.className = 'list-item-content';
            item.style.cursor = 'pointer';
            item.style.padding = '8px 0'; // 增加一點垂直内邊距

item.style.backgroundImage = `url('${preset.avatar || DEFAULT_AVATAR}')`;
item.innerHTML = `<span class="list-item-name">${preset.name}</span>`;
// ▲▲▲ 修改结束 ▲▲▲

            item.onclick = () => selectPersona(preset);
            modalList.appendChild(item);
        });
    }
    document.getElementById('persona-selection-modal').classList.add('active');
};

    const closePersonaSelectionModal = () => document.getElementById('persona-selection-modal').classList.remove('active');

const addContactAndCreateChat = async (persona) => {
    // 1. 检查是否已经是联系人 (双重保险)
    if (appState.contacts.some(c => c.name === persona.name)) {
        alert('该联系人已存在！');
        return;
    }

    // 2. 添加到联系人列表
    appState.contacts.push(persona);
    await dbStorage.set(KEYS.CONTACTS, appState.contacts);
    console.log(`联系人 ${persona.name} 已添加。`);

    // 3. 自动创建与该联系人的1对1聊天
    const myPersona = appState.personas.my[0];
    if (!myPersona) {
        alert('错误：请先在“我的素材库”中创建您自己的角色！');
        // 回滚操作
        appState.contacts = appState.contacts.filter(c => c.name !== persona.name);
        await dbStorage.set(KEYS.CONTACTS, appState.contacts);
        return;
    }

    const newChatId = 'chat_' + Date.now();
    appState.chats[newChatId] = {
        name: persona.name,
    type: 'single',
    history: [],
    pinned: true, // <--- 新增这一行，给新聊天打上置顶标记
    personas: {
            ai: persona, // AI方是这个新联系人
            my: myPersona // “我”是默认的第一个人设
        },
        wallpaper: null,
        memoryRounds: 0,
        isOfflineMode: false
    };
    await dbStorage.set(KEYS.CHATS, appState.chats);
    console.log(`与 ${persona.name} 的新聊天已创建。`);

    // 4. 打开新创建的聊天窗口
    openChat(newChatId);
};

    const selectPersona = (preset) => {
    const context = appState.personaSelectionContext;

    if (context === 'add_contact') {
        addContactAndCreateChat(preset); // <--- 调用我们新增的核心函数
        closePersonaSelectionModal();
        return;
    }

    // --- 以下是旧的逻辑，保持不变 ---
    const personaType = context.includes('ai') ? 'ai' : 'my';
    let targetElementId;

    if (context === 'group_my') {
        appState.newChatTempPersonas.my = preset;
        targetElementId = 'group-my-persona-selection-text';
    } else if (context.includes('new')) {
        appState.newChatTempPersonas[personaType] = preset;
        targetElementId = `new-chat-${personaType}-selection-text`;
    } else {
        appState.chats[appState.activeChatId].personas[personaType] = preset;
        targetElementId = `chat-${personaType}-selection-text`;
    }

    const targetElement = document.getElementById(targetElementId);
    if (targetElement) {
        targetElement.textContent = preset.name;
        targetElement.classList.remove('placeholder');
    }
    closePersonaSelectionModal();
};
    

// ▼▼▼ 【V2 - 升级版】替换旧的 openChatSettings 函数 ▼▼▼
const openChatSettings = () => {
    const chat = appState.chats[appState.activeChatId];
    if (!chat) {
        alert("错误：找不到当前的对话资料。");
        return;
    }

    document.getElementById('settings-main-avatar').src = chat.personas?.ai?.avatar || DEFAULT_AVATAR;
    document.getElementById('settings-main-name').textContent = chat.name || '对话设定';
    document.getElementById('chat-ai-persona-selection-text').textContent = chat.personas?.ai?.name || '未设定AI角色';
    document.getElementById('chat-my-persona-selection-text').textContent = chat.personas?.my?.name || '未设定我的角色';

    // ▼▼▼ 【核心修改】调用新的辅助函数来显示多选状态 ▼▼▼
    updatePromptSelectionDisplay(chat);
    // ▲▲▲ 修改结束 ▲▲▲

    document.getElementById('chat-name-input').value = chat.name || '';
    document.getElementById('chat-wallpaper-status').textContent = chat.wallpaper ? '已设置' : '未设置';
    document.getElementById('chat-memory-rounds-input').value = chat.memoryRounds || 0;

    const timeToggle = document.getElementById('time-awareness-toggle');
    if (timeToggle) {
        timeToggle.classList.toggle('active', !!chat.timeAwareness);
    }
    
    const offlineToggle = document.getElementById('offline-mode-toggle');
    if (offlineToggle) {
        offlineToggle.classList.toggle('active', !!chat.isOfflineMode);
    }

    const proactiveToggle = document.getElementById('proactive-messaging-toggle');
    if (proactiveToggle) {
        proactiveToggle.classList.toggle('active', !!chat.proactiveMessaging);
    }
    // 自动根据储存的分钟数，高亮对应的频率按钮
const frequencyValue = chat.proactiveInterval || 10; // 如果没设置，默认为10分钟（高）
document.querySelectorAll('#proactive-frequency-selector .segmented-control-button').forEach(btn => {
    btn.classList.remove('active');
    if (parseInt(btn.dataset.value) === frequencyValue) {
        btn.classList.add('active');
    }
});

    document.getElementById('settings-profile-item').onclick = () => {
        const personaIndex = appState.personas.ai.findIndex(p => p.name === chat.personas.ai.name);
        if (personaIndex > -1) {
            openPersonaEditor('ai', personaIndex);
        } else {
            alert('错误：在AI人设库中找不到对应的角色资料。');
        }
    };
    
    document.getElementById('phone-screen').classList.remove('offline-active');

    const deleteSection = document.getElementById('delete-contact-section');
    const deleteBtn = document.getElementById('delete-contact-btn');

    const blockSection = document.getElementById('block-contact-section');
    const blockBtn = document.getElementById('block-contact-btn');
    const unblockSection = document.getElementById('unblock-contact-section');
    const unblockBtn = document.getElementById('unblock-contact-btn');

    if (chat.type === 'single') {
        // 删除按钮的逻辑保持不变
        deleteSection.style.display = 'block';
        deleteBtn.onclick = () => deleteContact(appState.activeChatId);

        // 【核心修改】根据是否已拉黑，来决定显示哪个按钮
        if (chat.isBlocked) {
            // 如果已拉黑
            blockSection.style.display = 'none';     // 隐藏“拉黑”
            unblockSection.style.display = 'block';  // 显示“解除拉黑”
            unblockBtn.onclick = () => unblockContact(appState.activeChatId);
        } else {
            // 如果未拉黑
            blockSection.style.display = 'block';    // 显示“拉黑”
            unblockSection.style.display = 'none';   // 隐藏“解除拉黑”
            blockBtn.onclick = () => blockContact(appState.activeChatId);
        }

    } else {
        // 群聊时，隐藏所有这些按钮
        deleteSection.style.display = 'none';
        blockSection.style.display = 'none';
        unblockSection.style.display = 'none';
    }

    showScreen('chat-settings-screen');
};

    const switchTab = (tabName) => {
        appState.activeTab = tabName;
        document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.hub-page').forEach(el => el.classList.remove('active'));
        const tabButton = document.getElementById(`tab-btn-${tabName}`);
        if (tabButton) tabButton.classList.add('active');
        const page = document.getElementById(`hub-page-${tabName}`);
        if (page) page.classList.add('active');
        const hubTitle = document.getElementById('main-hub-title');
        hubTitle.textContent = tabButton.dataset.title || '聊天';
        
        const addBtn = document.getElementById('main-hub-add-btn');
        const editBtn = document.getElementById('main-hub-edit-btn');
        
        addBtn.style.display = 'none';
        editBtn.style.display = 'none';
        addBtn.onclick = null;

        if (tabName === 'chat') { 
            addBtn.style.display = 'block'; 
            addBtn.onclick = () => {
    document.getElementById('create-new-modal').classList.add('active');
};
            if (Object.keys(appState.chats).length > 0) editBtn.style.display = 'block';
            renderChatList(); 
        } else if (tabName === 'contacts') { 
            renderContactsList();
        } else if (tabName === 'moments') {
    addBtn.style.display = 'block';
    // 修改：点击加号时，打开新的朋友圈操作弹窗
    addBtn.onclick = () => {
        document.getElementById('moments-action-modal').classList.add('active');
    };
    renderMomentsFeed();
}

else if (tabName === 'me') {
    // ▼▼▼ 新增：加载“我”页面的个人信息 ▼▼▼
    const myPersona = appState.personas.my[0]; // 获取第一个“我的”人设
    const profileAvatar = document.getElementById('me-page-avatar');
    const profileName = document.getElementById('me-page-name');
    const profileDescription = document.getElementById('me-page-description');

    if (myPersona) {
        profileAvatar.src = myPersona.avatar || DEFAULT_AVATAR;
        profileName.textContent = myPersona.name;
        profileDescription.textContent = `人设: ${myPersona.content.substring(0, 20)}...`; // 只显示部分人设作为预览
    } else {
        profileAvatar.src = DEFAULT_AVATAR;
        profileName.textContent = '未设置角色';
        profileDescription.textContent = '请在素材库中创建角色';
    }
    // ▲▲▲ 新增代码结束 ▲▲▲
}

    };
    
    const openLocationModal = () => { document.getElementById('location-input-text').value = ''; document.getElementById('location-modal').classList.add('active'); };
    const closeLocationModal = () => document.getElementById('location-modal').classList.remove('active');
    const sendLocationMessage = async () => {
        const address = document.getElementById('location-input-text').value.trim();
        if (!address) { alert('地址不能為空！'); return; }
        const chat = appState.chats[appState.activeChatId];
        if (!chat) return;
        await checkAndInsertTimestamp();
        const timestamp = Date.now();
        const messageData = { type: 'location', address: address };
        appendMessage({ role: 'user', content: messageData, timestamp: timestamp });
        chat.history.push({ role: 'user', content: messageData, timestamp: timestamp });
        await dbStorage.set(KEYS.CHATS, appState.chats);
        closeLocationModal();
    };

    const openVoiceModal = () => { document.getElementById('voice-input-text').value = ''; document.getElementById('voice-modal').classList.add('active'); };
    const closeVoiceModal = () => document.getElementById('voice-modal').classList.remove('active');
    const sendVoiceMessage = async () => {
        const text = document.getElementById('voice-input-text').value.trim();
        if (!text) { alert('語音文字不能為空！'); return; }
        const chat = appState.chats[appState.activeChatId];
        if (!chat) return;
        await checkAndInsertTimestamp();
        const timestamp = Date.now();
        const duration = Math.max(1, Math.round(text.length / 4));
        const messageData = { type: 'voice', text: text, duration: duration };
        appendMessage({ role: 'user', content: messageData, timestamp: timestamp });
        chat.history.push({ role: 'user', content: messageData, timestamp: timestamp });
        await dbStorage.set(KEYS.CHATS, appState.chats);
        closeVoiceModal();
    };

    const openImageModal = () => { document.getElementById('image-input-text').value = ''; document.getElementById('image-modal').classList.add('active'); };
    const closeImageModal = () => document.getElementById('image-modal').classList.remove('active');
    const sendImageMessage = async () => {
        const text = document.getElementById('image-input-text').value.trim();
        if (!text) { alert('圖片內容不能為空！'); return; }
        const chat = appState.chats[appState.activeChatId];
        if (!chat) return;
        await checkAndInsertTimestamp();
        const timestamp = Date.now();
        const messageData = { type: 'image', text: text };
        appendMessage({ role: 'user', content: messageData, timestamp: timestamp });
        chat.history.push({ role: 'user', content: messageData, timestamp: timestamp });
        await dbStorage.set(KEYS.CHATS, appState.chats);
        closeImageModal();
    };

async function simulateAIReceivingTransfer(messageTimestamp) {
    const chat = appState.chats[appState.activeChatId];
    if (!chat) return;

    const transferMessage = chat.history.find(m => m.timestamp === messageTimestamp);
    if (!transferMessage || transferMessage.role !== 'user') return;

    transferMessage.content.isReceived = true;

    const messageElement = document.getElementById(`message-${messageTimestamp}`);
    if (messageElement) {
        const contentDiv = messageElement.querySelector('.content.transfer-content');
        if (contentDiv) {
            contentDiv.style.backgroundColor = '#fde1c3';
            const footer = contentDiv.querySelector('.transfer-footer');
            if (footer) footer.textContent = '对方已收款';
        }
    }

    // --- ▼▼▼ 以下是新增的核心逻辑 ▼▼▼ ---

    // 4. 创建一个AI视角的“已收款”回执消息
    const aiReceiptMessage = {
        role: 'assistant',
        content: {
            type: 'transfer',
            amount: transferMessage.content.amount,
            statusText: '已收款' // 使用这个特殊标记来识别它是一个回执
        },
        timestamp: Date.now()
    };

    // 5. 将AI的回执消息添加到历史记录并显示在界面上
    chat.history.push(aiReceiptMessage);
    appendMessage(aiReceiptMessage);

    // --- ▲▲▲ 新增逻辑结束 ▲▲▲ ---

    const hiddenSystemMessage = {
        role: 'system',
        content: `[系统事件：你收到了用户发来的 ¥${transferMessage.content.amount.toFixed(2)} 转账。]`,
        hidden: true,
        timestamp: Date.now() + 1 
    };
    chat.history.push(hiddenSystemMessage);

    await dbStorage.set(KEYS.CHATS, appState.chats);
  
}

// --- ▼▼▼ 請使用這個新版本完整替換舊的 handleReturnTransfer 函數 ▼▼▼ ---
const handleReturnTransfer = async (message, element) => {
    const chat = appState.chats[appState.activeChatId];
    if (!chat) return;

    // --- ▼▼▼ 您只需要加回這一段程式碼 ▼▼▼ ---
    // 1. 更新【原始 AI 紅包】的 UI 外觀，讓它也變成灰色
    const transferContentDiv = element.querySelector('.content.transfer-content');
    if (transferContentDiv) {
    transferContentDiv.style.backgroundColor = '#fde1c3';
    transferContentDiv.querySelector('.transfer-footer').textContent = '已退回'; // <--- 修改為這行
    transferContentDiv.style.cursor = 'default';
}

    // 2. 標記原始 AI 紅包為“已處理”，防止再次點擊 (此行保留)
    message.content.isReturned = true;

    // 3. 創建一個新的、使用者視角的“已退回”紅包訊息 (此部分不變)
    const userReturnMessage = {
        role: 'user',
        content: {
            type: 'transfer',
            amount: message.content.amount,
            remark: message.content.remark,
            statusText: '已退回'
        },
        timestamp: Date.now()
    };
    
    // 4. 將這個新的“已退回”紅包顯示在畫面上，並存入歷史記錄 (此部分不變)
    appendMessage(userReturnMessage);
    chat.history.push(userReturnMessage);

    // 5. 在背景中為 AI 添加一條隱藏的系統提示 (此部分不變)
    const hiddenSystemMessage = {
        role: 'system',
        content: `[系统事件：你发送的 ¥${message.content.amount.toFixed(2)} 红包已被用户退回。]`,
        hidden: true,
        timestamp: Date.now() + 1
    };
    chat.history.push(hiddenSystemMessage);
    
    // 6. 儲存所有變更並觸發 AI 的回應 (此部分不變)
    await dbStorage.set(KEYS.CHATS, appState.chats);
    await receiveMessageHandler();
};

// --- ▼▼▼ 請將此新函數添加到 <script> 內 ▼▼▼ ---
const showRedPacketConfirm = (message, element) => {
    const chat = appState.chats[appState.activeChatId];
    if (!chat) return;

    // 獲取並客製化現有的確認彈窗
    const modal = document.getElementById('custom-confirm-modal');
    const title = document.getElementById('custom-confirm-title');
    const text = document.getElementById('custom-confirm-text');
    const okBtn = document.getElementById('custom-confirm-ok-btn');
    const cancelBtn = document.getElementById('custom-confirm-cancel-btn');

    title.textContent = '紅包';
    text.innerHTML = `確認接收來自 <b>${chat.personas.ai.name}</b> 的紅包嗎？`;

    // 修改按鈕文字和樣式
    okBtn.textContent = '接收';
    cancelBtn.textContent = '退回';
    okBtn.style.backgroundColor = 'var(--wechat-green)'; // 接收按鈕使用綠色

    // 為按鈕綁定新的點擊事件
    okBtn.onclick = () => {
        handleReceiveTransfer(message, element); // 點擊“接收”則執行收款邏輯
        hideCustomConfirm();
    };
    cancelBtn.onclick = () => {
        handleReturnTransfer(message, element); // 點擊“退回”則執行退回邏輯
        hideCustomConfirm();
    };

    // 顯示彈窗
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    setTimeout(() => { modal.style.opacity = '1'; }, 10);
};
// --- ▲▲▲ 新增函數到此結束 ▲▲▲ ---

const handleReceiveTransfer = async (message, element) => {
    const chat = appState.chats[appState.activeChatId];
    if (!chat) return;

    message.content.isReceived = true;

    const transferContentDiv = element.querySelector('.content.transfer-content');
    if (transferContentDiv) {
        transferContentDiv.style.backgroundColor = '#fde1c3';
        const footer = transferContentDiv.querySelector('.transfer-footer');
        if (footer) {
            footer.textContent = '已被收款';
        }

        // 【新增】让这个红包气泡的光标变为默认样式，看起来不可再点击
        transferContentDiv.style.cursor = 'default';
    }
   

        // 3. 創建一個新的、使用者視角的「已收款」消息
        const userReceiptMessage = {
            role: 'user',
            content: {
                type: 'transfer',
                amount: message.content.amount,
                statusText: '已收款' // 使用這個特殊標記來識別
            },
            timestamp: Date.now()
        };
        
        // 4. 將新消息添加到歷史記錄並顯示在畫面上
        chat.history.push(userReceiptMessage);
        appendMessage(userReceiptMessage);

        // 5. 為了讓 AI 知道你收了錢，在背景加入一條隱藏的系統提示
        const hiddenSystemMessage = {
            role: 'system',
            content: `[系统事件：你发送的 ¥${message.content.amount.toFixed(2)} 转账已被用户收款。]`,
            hidden: true,
            timestamp: Date.now() + 1 // 確保時間戳唯一
        };
        chat.history.push(hiddenSystemMessage);
        
        // 6. 將所有更新保存到資料庫
        await dbStorage.set(KEYS.CHATS, appState.chats);
    };

/**
 * 【全新】核心决策函数：在后台请求AI决定是否接听电话
 */
async function requestCallDecision() {
    const chat = appState.chats[appState.activeChatId];
    if (!chat) return;

    // 1. 立刻显示“呼叫中”界面
    document.getElementById('outgoing-call-avatar').src = chat.personas.ai.avatar || DEFAULT_AVATAR;
    document.getElementById('outgoing-call-name').textContent = chat.personas.ai.name;
    showScreen('outgoing-call-screen');

    // 在后台，准备API请求
    try {
        const systemPrompt = `你正在扮演角色：“${chat.personas.ai.content}”。
用户现在正给你打视频电话。你的任务是根据你当前的角色性格和心情，以及你们最近的聊天上下文，来决定是“接听”还是“拒接”这个电话。

你的回复必须是一个JSON对象，且只包含以下两个键：
1.  "action": 必须是 "accept" 或 "decline" 字符串。
2.  "reason": 一个字符串，用你的角色口吻解释你为什么“拒接”（如果接听则留空）。

例如:
- 如果决定拒接: {"action": "decline", "reason": "我现在有点忙，晚点打给你吧。"}
- 如果决定接听: {"action": "accept", "reason": ""}`;

        const historyForAPI = processHistoryForAPI(chat.history);
        const response = await fetch(`${appState.apiConfig.url.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${appState.apiConfig.key}` },
            body: JSON.stringify({
                model: appState.apiConfig.model,
                messages: [{ role: 'system', content: systemPrompt }, ...historyForAPI],
                response_format: { "type": "json_object" }
            })
        });

        if (!response.ok) throw new Error('AI决策时API请求失败');
        
        const data = await response.json();
        const decision = JSON.parse(data.choices[0].message.content);

        // 2. 根据AI的决定，执行不同操作
        if (decision.action === 'accept') {
            // AI同意接听，进入正常的视频通话流程
            startVideoCall(); 
        } else {
            // AI拒接
            handleCallDeclineByAI(decision.reason);
        }

    } catch (error) {
        // 如果决策过程出错，就默认让AI接听电话，避免流程卡死
        console.error("请求AI决策时出错:", error);
        startVideoCall();
    }
}

/**
 * 【全新】处理AI拒接电话的函数
 * @param {string} reason - AI拒接的理由
 */
async function handleCallDeclineByAI(reason) {
    // 1. 隐藏“呼叫中”界面，返回聊天页
    showScreen('chat-screen');

    // 2. 在聊天界面显示“对方已拒接”
    await appendSystemMessageToChat('对方已拒接');

    // 3. 如果AI给出了拒接理由，则作为一条消息发送出来
    if (reason) {
        const chat = appState.chats[appState.activeChatId];
        if (!chat) return;

        // 模拟一小段延迟，让拒接理由看起来更自然
        await new Promise(res => setTimeout(res, 800));

        const messageObject = { role: 'assistant', content: reason, timestamp: Date.now() };
        appendMessage(messageObject);
        chat.history.push(messageObject);
        await dbStorage.set(KEYS.CHATS, appState.chats);
    }
}

    const startVideoCall = async () => {
        const chat = appState.chats[appState.activeChatId];
        if (!chat) return;

        // 【修复】生成唯一的通话ID并存储，同时立刻在历史记录中打下“开始”标记
        const callId = `call_${Date.now()}`;
        appState.currentCallId = callId;
        chat.history.push({
            role: 'system',
            content: '[视频通话开始]',
            timestamp: Date.now(),
            hidden: true,
            callId: callId
        });
        await dbStorage.set(KEYS.CHATS, appState.chats);

        // --- 以下为原有的UI设置逻辑，保持不变 ---
        document.getElementById('videocall-bg-image').src = chat.personas.ai.avatar || DEFAULT_AVATAR;
        document.getElementById('videocall-my-avatar').src = chat.personas.my.avatar || DEFAULT_AVATAR;
        document.getElementById('videocall-messages').innerHTML = '';
        document.getElementById('videocall-input').value = '';
        appState.videoCallMessages = [];
        showScreen('videocall-screen');

    /* ▼▼▼ 从这里开始，是新增的代码 ▼▼▼ */
    const timerDisplay = document.getElementById('call-duration-timer');
    if (timerDisplay) {
        // 清理上一次的计时器（以防万一）
        if (callTimerInterval) clearInterval(callTimerInterval);

        const startTime = Date.now();
        timerDisplay.textContent = '00:00';
        timerDisplay.style.display = 'block'; // 让计时器显示出来

        // 每秒更新一次时间
        callTimerInterval = setInterval(() => {
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
            const seconds = (elapsedSeconds % 60).toString().padStart(2, '0');
            timerDisplay.textContent = `${minutes}:${seconds}`;
        }, 1000);
    }

        const messagesContainer = document.getElementById('videocall-messages');
        const statusMsg = document.createElement('p');
        statusMsg.className = 'videocall-message';
        statusMsg.textContent = '视频通话连接中...';
        messagesContainer.appendChild(statusMsg);
        setTimeout(() => {
            statusMsg.textContent = '已连接';
            setTimeout(async () => {
                statusMsg.remove();
                await triggerInitialVideoCallMessage();
            }, 1000);
        }, 1500);
    };
    
    const triggerInitialVideoCallMessage = async () => {
         try {
            const chat = appState.chats[appState.activeChatId];
            if (!chat) return;
            const systemContent = `
这是你和用户的对话记录。现在，你们从文字聊天切换到了视频通话。
你的任务是继续扮演角色：“${chat.personas.ai.content}”。
请根据聊天记录的上下文，主动说出接通视频后的第一句话，自然地衔接之前的话题。
你的回复必须是一段简短的、口语化的文字，并且必须包含用星号（*...*）包裹的动作、表情或环境描写。
例如：“*我对着镜头笑了笑* 刚才说到那个电影，我正好想起来...”。`;

            const historyForAPI = processHistoryForAPI(chat.history);

            const response = await fetch(`${appState.apiConfig.url.replace(/\/$/, '')}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${appState.apiConfig.key}` },
                body: JSON.stringify({ model: appState.apiConfig.model, messages: [{ role: 'system', content: systemContent }, ...historyForAPI] })
            });
            if (!response.ok) throw new Error((await response.json()).error?.message || `HTTP 錯誤`);
            
            const data = await response.json();
            const aiResponseText = data.choices[0]?.message?.content.trim();
            if (aiResponseText) {
                const messagesContainer = document.getElementById('videocall-messages');
                const aiMsg = document.createElement('p');
                aiMsg.className = 'videocall-message ai-call';
                
                // ▼▼▼ 核心修改在这里 ▼▼▼
                aiMsg.innerHTML = formatVideoCallMessage(aiResponseText);
                // ▲▲▲ 修改结束 ▲▲▲

                messagesContainer.appendChild(aiMsg);
                appState.videoCallMessages.push({ role: 'assistant', content: aiResponseText });
            }
        } catch (error) {
            const messagesContainer = document.getElementById('videocall-messages');
            const errorMsg = document.createElement('p');
            errorMsg.className = 'videocall-message';
            errorMsg.textContent = `错误: ${error.message}`;
            messagesContainer.appendChild(errorMsg);
        }
    };

const processHistoryForAPI = (history) => {
    const apiHistory = [];
    const processedIndices = new Set();
    const chat = appState.chats[appState.activeChatId]; 

    for (let i = 0; i < history.length; i++) {
        if (processedIndices.has(i)) {
            continue;
        }

        const m = history[i];
        let currentApiMessage = null;
        const content = m.content;

        const next_m = (i + 1 < history.length) ? history[i + 1] : null;
        if (m.role === 'user' && m.content?.type === 'just_image' && next_m?.role === 'user' && typeof next_m?.content === 'string') {
            currentApiMessage = {
                role: 'user',
                content: [
                    { type: 'image_url', image_url: { url: m.content.url } },
                    { type: 'text', text: next_m.content }
                ]
            };
            processedIndices.add(i);
            processedIndices.add(i + 1);
        }
        else if (m.role === 'user' && m.content?.type === 'just_image') {
             currentApiMessage = {
                role: 'user',
                content: [
                    { type: 'image_url', image_url: { url: m.content.url } },
                    { type: 'text', text: ' ' }
                ]
            };
            processedIndices.add(i);
        }
        else {
            if (m.role === 'system') {
                if (m.type === 'retraction' && m.originalContent) {
                    currentApiMessage = { role: 'system', content: `[你刚刚撤回了一条消息，内容是：“${m.originalContent}”]` };
                }
                else if (m.type === 'call_log') {
                    currentApiMessage = { role: 'system', content: `[系统事件: ${m.content}]` };
                }
                else if (m.hidden === true) {
                    currentApiMessage = { role: 'system', content: content };
                }
                else {
                    currentApiMessage = null;
                }
            }
            else if (typeof content === 'object' && content !== null) {
                let simplifiedContent = '';
                switch (content.type) {
                    case 'sticker': // <--- ▼▼▼ 新增这个 case ▼▼▼
        simplifiedContent = `[用户发送了表情，表情内容是：“${content.name}”]`;
        break;

    case 'location': // <--- 这是原来的 case，放在新增的 case 之后
        simplifiedContent = `[使用者分享了一个位置: ${content.address}]`;
        break;
                    case 'voice': simplifiedContent = `[使用者传送了一段语音讯息，内容是: “${content.text}”]`; break;
                    case 'send_image_text':
                        simplifiedContent = `[${m.author || 'AI'}发送了一张图片：“${content.text}”]`;
                        break;
                    case 'image':
                        simplifiedContent = `[你发送了一张图片：“${content.text}”]`;
                        break;
 // ... 在 processHistoryForAPI 函数内部 ...
case 'transfer':
case 'send_transfer':
    // 【核心修正】在这里只生成文本描述，不操作UI
    let transferText = '';
    if (m.role === 'user' && content.statusText === '已收款') {
        transferText = `[系统事件：用户收下了你发送的 ¥${content.amount.toFixed(2)} 转账。]`;
    } else {
        const sender = (m.role === 'user') ? '用户' : '你';
        const action = (m.role === 'user') ? '给你' : '给用户';
        transferText = `[${sender} ${action}发起了一笔转账，金额为 ¥${content.amount.toFixed(2)}`;
        if (content.remark) {
            transferText += `，备注是：“${content.remark}”`;
        }
        transferText += ']';
    }
    simplifiedContent = transferText;
    break;

                     case 'moment_post': simplifiedContent = `[${content.author}发布了一条朋友圈动态: "${content.text}", 配图想法: "${content.image}"]`; break;
                    default: simplifiedContent = `[使用者傳送了一條特殊訊息]`; break;
                }
                currentApiMessage = { role: m.role, content: simplifiedContent };
            }
            else {
                let finalContent = content;
                if (m.replyTo) {
                    const repliedTo = m.replyTo;
                    let repliedToAuthorName = '对方';
                    if (repliedTo.role === 'user') {
                        repliedToAuthorName = chat.personas.my.name;
                    } else {
                        const persona = chat.type === 'group' ? chat.personas.ai.find(p => p.name === repliedTo.author) : chat.personas.ai;
                        repliedToAuthorName = persona?.name || 'AI';
                    }
                    const summarizedQuote = summarizeLastMessage(repliedTo);
                    finalContent = `[回复 ${repliedToAuthorName} 的消息: “${summarizedQuote}”] ${content}`;
                }
                currentApiMessage = { role: m.role, content: finalContent };
            }
            processedIndices.add(i);
        }

        if (currentApiMessage) {
            apiHistory.push(currentApiMessage);
        }
    }
    return apiHistory;
};

    const sendVideoCallMessage = async () => {
        const input = document.getElementById('videocall-input');
        const sendBtn = document.getElementById('videocall-send-btn');
        const text = input.value.trim();
        if (!text) return;

        input.disabled = true;
        sendBtn.disabled = true;

        const messagesContainer = document.getElementById('videocall-messages');
        const userMsg = document.createElement('p');
        userMsg.className = 'videocall-message user-call';
        userMsg.textContent = text;
        messagesContainer.appendChild(userMsg);
        
        appState.videoCallMessages.push({ role: 'user', content: text });
        
        input.value = '';
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        const loadingDots = document.createElement('div');
        loadingDots.id = 'video-call-loading-dots';
        loadingDots.className = 'videocall-message loading';
        loadingDots.innerHTML = '<span></span><span></span><span></span>';
        messagesContainer.appendChild(loadingDots);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        try {
            const chat = appState.chats[appState.activeChatId];
            const systemContent = `
你正在与用户进行视频通话。
你的任务是扮演角色：“${chat.personas.ai.content}”。
你的回复必须是一段简短的、口语化的文字。
至关重要的是，你的回复中必须包含用星号（*...*）包裹的动作、表情或环境描写，以体现你们正在视频通话。
例如：“*我靠近了一点屏幕，微笑着说* 嘿，我能清楚地看到你。连接好像很顺畅。” 或 “*我听到窗外传来一阵鸟叫，稍微分了下神* 啊，你刚才说什么？”
请根据用户的上一句话，自然地进行回应。`;

            const processedMainHistory = processHistoryForAPI(chat.history);
            const fullContext = [...processedMainHistory, ...appState.videoCallMessages];

            const response = await fetch(`${appState.apiConfig.url.replace(/\/$/, '')}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${appState.apiConfig.key}` },
                body: JSON.stringify({ model: appState.apiConfig.model, messages: [{ role: 'system', content: systemContent }, ...fullContext] })
            });
            if (!response.ok) throw new Error((await response.json()).error?.message || `HTTP 錯誤`);
            const data = await response.json();
            const aiResponseText = data.choices[0]?.message?.content.trim();

            // ...
if (aiResponseText) {
    const aiMsg = document.createElement('p');
    aiMsg.className = 'videocall-message ai-call';

    aiMsg.innerHTML = formatVideoCallMessage(aiResponseText); // <-- 直接调用小帮手

    messagesContainer.appendChild(aiMsg);
    appState.videoCallMessages.push({ role: 'assistant', content: aiResponseText });
}
// ...
        } catch (error) {
            const errorMsg = document.createElement('p');
            errorMsg.className = 'videocall-message';
            errorMsg.textContent = `错误: ${error.message}`;
            messagesContainer.appendChild(errorMsg);
        } finally {
            const loadingDotsElement = document.getElementById('video-call-loading-dots');
            if (loadingDotsElement) {
                loadingDotsElement.remove();
            }
            
            input.disabled = false;
            sendBtn.disabled = false;
            input.focus();
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    };
   // ▼▼▼ 请将这个全新的函数添加到你的 <script> 内 ▼▼▼

const formatVideoCallMessage = (text) => {
    // 确保输入的是字符串，如果不是，则返回空字符串以避免错误
    if (typeof text !== 'string') {
        return ''; 
    }
    // 使用正則表達式，尋找所有被星號(*)包裹的文字，
    // 並將其替換為被 <i> 標籤（斜體）包裹的相同文字。
    // 例如，"*我笑了笑*" 会变成 "<i>我笑了笑</i>"
    return text.replace(/\*(.*?)\*/g, '<i>$1</i>');
};

// ▲▲▲ 添加到此结束 ▲▲▲

    // ▼▼▼ 在这里粘贴下面的新函数 ▼▼▼
    const endVideoCall = async () => {
    /* ▼▼▼ 从这里开始，是新增的代码 ▼▼▼ */
    // 停止计时器并隐藏
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
    }
    const timerDisplay = document.getElementById('call-duration-timer');
    if (timerDisplay) {
        timerDisplay.style.display = 'none';
    }

        const chat = appState.chats[appState.activeChatId];
        if (!chat || !appState.currentCallId) return;

        const startTime = chat.history.find(msg => msg.callId === appState.currentCallId)?.timestamp;
        const endTime = Date.now();
        let durationText = '未知时长';

        if (startTime) {
            const durationSeconds = Math.round((endTime - startTime) / 1000);
            const minutes = Math.floor(durationSeconds / 60);
            const seconds = durationSeconds % 60;
            durationText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // 将本次通话的聊天记录（保存在临时的videoCallMessages中）合并到主历史记录里
        appState.videoCallMessages.forEach(msg => {
            chat.history.push({
                ...msg,
                timestamp: Date.now() + Math.random(), // 确保时间戳唯一
                hidden: true, // 在聊天界面中隐藏这些过程
                callId: appState.currentCallId
            });
        });

        // 添加一条通话结束的系统消息
        const callLogMessage = {
            content: `视频通话已结束，通话时长 ${durationText}`,
            type: 'call_log',
            callId: appState.currentCallId
        };
        
        appendMessage({ role: 'system', ...callLogMessage, timestamp: endTime });
        chat.history.push({
            role: 'system',
            ...callLogMessage,
            timestamp: endTime
        });

        await dbStorage.set(KEYS.CHATS, appState.chats);

    // ▼▼▼ 在这里添加关闭面板的逻辑 ▼▼▼
    const stickerPanel = document.getElementById('sticker-panel');
    if (stickerPanel.classList.contains('visible')) {
        stickerPanel.classList.remove('visible');
    }

    // 发送后返回聊天界面 (这一行原本就有，保留即可)
    showScreen('chat-screen'); 
};

   

    const openCallLogView = (endTimestamp) => {
        const chat = appState.chats[appState.activeChatId];
        if (!chat) return;

        const logContainer = document.getElementById('call-log-messages');
        logContainer.innerHTML = '';

        const endIndex = chat.history.findIndex(msg => msg.timestamp === endTimestamp);
        if (endIndex === -1) return;

        const callId = chat.history[endIndex].callId;

        let startIndex = -1;

        for (let i = endIndex - 1; i >= 0; i--) {
            const msg = chat.history[i];
            if (msg.callId === callId && msg.content === '[视频通话开始]') {
                startIndex = i;
                break;
            }
        }
        
        if (startIndex === -1) {
            logContainer.innerHTML = '<p class="videocall-message">无法找到对应的通话开始记录。</p>';
            showScreen('call-log-screen');
            return;
        }

        const callMessages = chat.history.slice(startIndex + 1, endIndex);

        callMessages.forEach(msg => {
            const msgElement = document.createElement('p');
            msgElement.className = 'videocall-message';

            if (msg.role === 'user') {
                msgElement.classList.add('user-call');
                msgElement.textContent = msg.content;
            } else { 
                msgElement.classList.add('ai-call');
                const content = msg.content;

                // ▼▼▼ 核心修改在这里 ▼▼▼
                msgElement.innerHTML = formatVideoCallMessage(content);
                // ▲▲▲ 修改结束 ▲▲▲
            }
            logContainer.appendChild(msgElement);
        });

        showScreen('call-log-screen');
    };

// ▼▼▼ 请将此函数添加到您的 <script> 内 ▼▼▼

const saveAndRenderMoments = async () => {
    // 1. 将包含新帖子的整个 momentsData 对象保存到数据库
    await dbStorage.set(KEYS.MOMENTS_DATA, appState.momentsData);
    
    // 2. 重新渲染朋友圈界面，以确保所有数据都是最新的
    renderMomentsFeed();
};

// ▼▼▼ 请使用这个【最终修正版】，完整替换你代码中旧的 renderSingleMoment 函数 ▼▼▼
const renderSingleMoment = (post, index) => {
    const postEl = document.createElement('div');
    postEl.className = 'moment-post';
    
    const myName = appState.personas.my[0]?.name;
    const postAuthorPersona = appState.personas.ai.find(p => p.name === post.author) || appState.personas.my.find(p => p.name === post.author) || {};
    const authorAvatar = postAuthorPersona?.avatar || DEFAULT_AVATAR;

    const textHTML = post.text ? `<div class="post-text">${post.text.replace(/\n/g, '<br>')}</div>` : '';

    let imagesHTML = '';
    const hasImages = post.image_prompts && Array.isArray(post.image_prompts) && post.image_prompts.length > 0;
    if (hasImages) {
        const imageItemsHTML = post.image_prompts.map(prompt => `
    <div class="post-image-item">
        <div class="image-text-cover"><img src="https://i.postimg.cc/RF2kGBvN/A0-E8-A59-DE8-E7368-B0824-AA62553191-E8.jpg" style="width: 100%; height: 100%; object-fit: cover;"></div>
        <div class="image-text-details">${prompt.replace(/\n/g, '<br>')}</div>
    </div>`).join('');
        imagesHTML = `<div class="post-images-grid image-count-${post.image_prompts.length}">${imageItemsHTML}</div>`;
    }
    
    const hasLikes = post.likes && post.likes.length > 0;
    const hasComments = post.comments && post.comments.length > 0;
    const likesHTML = hasLikes ? `<div class="likes-list">♡ ${post.likes.map(name => `<b>${name}</b>`).join(', ')}</div>` : '';
    const commentInputHTML = `<div class="comment-input-area" id="comment-input-area-${index}"><input type="text" id="comment-input-${index}" placeholder="评论..."><button class="comment-send-btn" data-post-index="${index}">发送</button></div>`;
    let commentsSectionHTML = '';
    if (hasComments) {
        const commentsListHTML = post.comments.map((comment, i) => {
            const authorName = comment.author;
            let authorDisplayHTML = `<b>${authorName}</b>`;
            if (comment.role === 'assistant' && i > 0 && post.comments[i-1]?.role === 'user') {
                authorDisplayHTML = `<b>${authorName}</b><span style="color: #444;"> 回复 </span><b>${post.comments[i-1].author}</b>`;
            }
            return `<div class="comment-item">${authorDisplayHTML}: <span>${comment.content.replace(/\n/g, '<br>')}</span></div>`;
        }).join('');
        commentsSectionHTML = `<div class="moment-comments-section"><div class="comments-list">${commentsListHTML}</div>${commentInputHTML}</div>`;
    } else {
         commentsSectionHTML = `<div class="moment-comments-section" style="display: none;">${commentInputHTML}</div>`;
    }
    let interactionAreaHTML = '';
    if (hasLikes || hasComments) {
         interactionAreaHTML = `<div class="moment-interaction-area">${likesHTML}${commentsSectionHTML}</div>`;
    } else {
        interactionAreaHTML = `<div class="moment-interaction-area" style="display: none;">${commentsSectionHTML}</div>`;
    }
    
    const deleteButtonHTML = post.author === myName ? `
        <div class="popup-divider"></div>
        <div class="popup-action delete-moment-btn" data-post-index="${index}" style="color: #ff3b30;">🗑️&nbsp;删除</div>
    ` : '';

    postEl.innerHTML = `
        <img src="${authorAvatar}" class="avatar">
        <div class="post-body" data-author="${post.author}">
            <div class="author-name">${post.author}</div>
            ${textHTML}
            ${imagesHTML}
            <div class="post-interactions">
                <span>${new Date(post.timestamp).toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'})}</span>
                <div class="interaction-buttons">
                     <button class="interaction-toggle-btn" data-post-index="${index}">..</button>
                     <div class="interaction-popup" id="popup-${index}">
                         <div class="popup-action like-btn" data-post-index="${index}" data-author="${post.author}">♡&nbsp;赞</div>
                         <div class="popup-divider"></div>
                         <div class="popup-action comment-btn" data-post-index="${index}">☆&nbsp;评论</div>
                         ${deleteButtonHTML}
                     </div>
                </div>
            </div>
            ${interactionAreaHTML}
        </div>`;
    
    let pressTimer = null;
    let longPressTriggered = false;

    const startPress = (e) => {
        // ▼▼▼ 核心修正：当用户触摸的是可滚动的文字区域时，不再阻止默认滚动行为 ▼▼▼
        if (e.target.closest('.image-text-details')) {
            // 如果触摸点在文字详情区域，则什么都不做，允许浏览器自由滚动
        } else if (e.target.closest('.post-image-item')) {
            // 否则，如果触摸点在图片区域的其他地方（如封面），才阻止默认行为
            e.preventDefault();
        }
        // ▲▲▲ 修正结束 ▲▲▲
        
        longPressTriggered = false;
        pressTimer = setTimeout(() => {
            longPressTriggered = true;
            deleteMomentPost(index); 
        }, 700); 
    };
    
    const endPress = (e) => {
        clearTimeout(pressTimer);
        if (!longPressTriggered) {
            const imageItem = e.target.closest('.post-image-item');
            if (imageItem) {
                const cover = imageItem.querySelector('.image-text-cover');
                const details = imageItem.querySelector('.image-text-details');
                if (cover && details) {
                    const isCoverVisible = getComputedStyle(cover).display !== 'none';
                    cover.style.display = isCoverVisible ? 'none' : 'flex';
                    details.style.display = isCoverVisible ? 'block' : 'none';
                }
            }
        }
    };

    postEl.addEventListener('mousedown', startPress);
    postEl.addEventListener('mouseup', endPress);
    postEl.addEventListener('mouseleave', () => clearTimeout(pressTimer)); 

    postEl.addEventListener('touchstart', startPress, { passive: false });
    postEl.addEventListener('touchend', endPress);
    postEl.addEventListener('touchcancel', () => clearTimeout(pressTimer));

    return postEl;
};

// 【全新函數】加載更多朋友圈
const loadMoreMoments = () => {
    const feedContainer = document.getElementById('moments-feed');
    const loadMoreBtn = document.getElementById('load-more-moments-btn');
    if (loadMoreBtn) loadMoreBtn.remove();

    const allPosts = appState.momentsData.posts;
    const currentCount = appState.currentMomentsRenderIndex;
    
    const nextPosts = allPosts.slice(currentCount, currentCount + MOMENTS_PER_PAGE);

    nextPosts.forEach((post, i) => {
        const postIndex = currentCount + i;
        const postEl = renderSingleMoment(post, postIndex);
        feedContainer.appendChild(postEl);
    });

    appState.currentMomentsRenderIndex += nextPosts.length;

    if (appState.currentMomentsRenderIndex < allPosts.length) {
        const newLoadMoreBtn = document.createElement('div');
        newLoadMoreBtn.id = 'load-more-moments-btn';
        newLoadMoreBtn.textContent = '加载更早的动态';
        newLoadMoreBtn.style.cssText = `text-align: center; padding: 15px; color: var(--system-message-color); font-size: 13px; cursor: pointer;`;
        newLoadMoreBtn.onclick = loadMoreMoments;
        feedContainer.appendChild(newLoadMoreBtn);
    }
};

  const renderMomentsFeed = () => {
    const feedContainer = document.getElementById('moments-feed');
    feedContainer.innerHTML = ''; // 清空舊內容
    appState.currentMomentsRenderIndex = 0; // 重置計數器

    const { cover, avatar: myAvatar, posts: allPosts } = appState.momentsData;
    
    document.getElementById('moments-cover-img').src = cover || '';
    document.getElementById('moments-user-avatar').src = myAvatar || (appState.personas.my[0]?.avatar || DEFAULT_AVATAR);
    
    // 只截取第一頁的動態
    const initialPosts = allPosts.slice(0, MOMENTS_PER_PAGE);

    // 使用新的輔助函數來渲染第一頁的動態
    initialPosts.forEach((post, index) => {
        const postEl = renderSingleMoment(post, index);
        feedContainer.appendChild(postEl);
    });

    appState.currentMomentsRenderIndex = initialPosts.length;

    // 如果還有更多動態，則顯示“加載更多”按鈕
    if (allPosts.length > MOMENTS_PER_PAGE) {
        const loadMoreBtn = document.createElement('div');
        loadMoreBtn.id = 'load-more-moments-btn';
        loadMoreBtn.textContent = '加载更早的动态';
        loadMoreBtn.style.cssText = `text-align: center; padding: 15px; color: var(--system-message-color); font-size: 13px; cursor: pointer;`;
        loadMoreBtn.onclick = loadMoreMoments;
        feedContainer.appendChild(loadMoreBtn);
    }
};

// ▼▼▼ 【最终修正版 - 带边界检查】updateStatusBubble 函数 ▼▼▼
const updateStatusBubble = (statusText) => {
    // 如果没有状态文字，或AI还没有发过言，就直接返回
    if (!statusText) {
        return;
    }

    // 1. 先移除任何可能残存的旧泡泡，确保每次只显示一个
    const oldBubble = document.querySelector('.ai-status-popup');
    if (oldBubble) {
        oldBubble.remove();
    }

    // 2. 找到聊天界面中最后一个AI头像
    const messagesContainer = document.getElementById('chat-messages');
    const allAiAvatars = messagesContainer.querySelectorAll('.message-wrapper.ai .avatar');
    
    // 如果AI还没发过消息，就找不到头像，此时不显示泡泡
    if (allAiAvatars.length === 0) {
        return;
    }
    const lastAiAvatar = allAiAvatars[allAiAvatars.length - 1];

    // 3. 创建新的状态泡泡元素
    const newBubble = document.createElement('div');
    newBubble.className = 'ai-status-popup';
    newBubble.textContent = statusText;

    // 4. 将新泡泡添加到聊天容器中，以便进行绝对定位和尺寸计算
    messagesContainer.appendChild(newBubble);

    // 5. 计算并设置泡泡的精确位置
    const avatarRect = lastAiAvatar.getBoundingClientRect();
    const containerRect = messagesContainer.getBoundingClientRect();

    // 【新增】获取泡泡和容器的宽度，用于边界检查
    const bubbleWidth = newBubble.offsetWidth;
    const containerWidth = messagesContainer.offsetWidth;

    // 计算理想的中心位置
    const idealLeft = avatarRect.left - containerRect.left + (avatarRect.width / 2);
    let finalLeft = idealLeft; // 先假设理想位置就是最终位置

    // 【新增】进行边界检查和校正
    const halfBubbleWidth = bubbleWidth / 2;
    const minLeft = halfBubbleWidth + 5; // 泡泡左侧不能小于这个值（+5是增加一点边距）
    const maxLeft = containerWidth - halfBubbleWidth - 5; // 泡泡右侧不能超过这个值（-5是增加一点边距）

    if (idealLeft < minLeft) {
        // 如果过于靠左，就把它贴到左边界
        finalLeft = minLeft;
    } else if (idealLeft > maxLeft) {
        // 如果过于靠右，就把它贴到右边界
        finalLeft = maxLeft;
    }

    // 最终设置校正后的位置
    const top = avatarRect.top - containerRect.top;
    newBubble.style.top = `${top}px`;
    newBubble.style.left = `${finalLeft}px`;

    // 6. 动画结束后自动移除元素 (此部分逻辑不变)
    newBubble.addEventListener('animationend', () => {
        if (newBubble.parentNode) {
            newBubble.remove();
        }
    });
};

let notificationTimeout = null; // 用于自动隐藏通知的计时器

const showTopNotification = (chatId, messageContent) => {
    const island = document.getElementById('dynamic-island');
    const islandContentWrapper = island.querySelector('.island-content-wrapper');
    const chat = appState.chats[chatId];
    if (!chat || !island) return;

    clearTimeout(notificationTimeout);

    islandContentWrapper.innerHTML = `
        <div class="notification-content-wrapper">
            <img src="${chat.personas.ai.avatar || DEFAULT_AVATAR}" class="notification-avatar">
            <div class="notification-text-content">
                <div class="notification-title">${chat.name}</div>
                <div class="notification-body">${messageContent.replace(/<br>/g, ' ')}</div>
            </div>
        </div>
    `;

    island.onclick = () => {
        openChat(chatId);
        hideTopNotification();
    };

    // 【关键】在显示前，先移除所有其他可能的外观类
    island.classList.remove('default-pill', 'expanded-retraction');
    
    // 然后再同时添加“外观类”和“显示类”
    island.classList.add('notification-banner', 'visible');

    notificationTimeout = setTimeout(hideTopNotification, 5000);
};

// 【最终修正版 V4】隐藏顶部通知的函数
const hideTopNotification = () => {
    const island = document.getElementById('dynamic-island');
    if (!island) return;

    clearTimeout(notificationTimeout);

    // 1. 移除 .visible 类，触发“隐藏”动画
    island.classList.remove('visible');
    island.onclick = null;

    // 2. 等待隐藏动画结束后，将灵动岛重置为“小药丸”状态并重新显示它
    setTimeout(() => {
        island.classList.remove('notification-banner'); 
        island.classList.add('default-pill');
        island.querySelector('.island-content-wrapper').innerHTML = '';

        // 3. 再次添加 .visible，让小药丸自己播放“显示”动画
        island.classList.add('visible');
    }, 600); 
};

// 【最终修正版 V4】恢复灵动岛至默认小药丸状态
const revertIslandToDefault = () => {
    const island = document.getElementById('dynamic-island');
    if (!island) return;
    
    // 1. 移除 .visible 类，触发“隐藏”动画
    island.classList.remove('visible');

    // 2. 等待隐藏动画结束后，重置为“小药丸”并显示
    setTimeout(() => {
        island.classList.remove('expanded-retraction');
        island.classList.add('default-pill');
        island.querySelector('.island-content-wrapper').innerHTML = '';

        // 3. 再次添加 .visible，让小药丸自己播放“显示”动画
        island.classList.add('visible');
    }, 600);
};
   
    const applyWidgetImages = () => {
        const { bg, footer, avatar } = appState.widgetImages;
        const bgElement = document.getElementById('new-widget-bg');
        const footerElement = document.getElementById('new-widget-footer');
        const avatarElement = document.getElementById('new-widget-avatar');

        // 检查是否有背景图，有则设置，没有则清除
        if (bg) {
            bgElement.style.backgroundImage = `url(${bg})`;
        } else {
            bgElement.style.backgroundImage = 'none';
        }

        // 检查是否有页脚图，有则设置，没有则清除
        if (footer) {
            footerElement.style.backgroundImage = `url(${footer})`;
        } else {
            footerElement.style.backgroundImage = 'none';
        }

        // 检查是否有头像图，有则设置，没有则清除
        if (avatar) {
            avatarElement.style.backgroundImage = `url(${avatar})`;
        } else {
            avatarElement.style.backgroundImage = 'none';
        }
    };

    const showIncomingCallScreen = (reason) => {
        const chat = appState.chats[appState.activeChatId];
        if (!chat) return;

        document.getElementById('incoming-call-avatar').src = chat.personas.ai.avatar || DEFAULT_AVATAR;
        document.getElementById('incoming-call-name').textContent = chat.personas.ai.name;
        document.getElementById('incoming-call-reason').textContent = reason || '正在邀请你进行视频通话...';

        // 绑定一次性事件
        document.getElementById('accept-call-btn').onclick = handleCallAccept;
        document.getElementById('decline-call-btn').onclick = handleCallDecline;
        
        showScreen('incoming-call-screen');
    };

    const handleCallAccept = () => {
        showScreen('chat-screen'); // 先切回聊天，再开始通话流程
        startVideoCall();
    };

    const handleCallDecline = async () => {
        const chat = appState.chats[appState.activeChatId];
        if (!chat) return;
        
        // 在聊天记录里添加一条“已拒接”的系统消息
        await appendSystemMessageToChat('你拒绝了通话邀请');
        showScreen('chat-screen');

        // 可以选择性地触发AI，让它对你拒接电话做出反应
        // receiveMessageHandler(); 
    };

// ▼▼▼ 步骤2：改造 toggleOfflineMode，让它只负责更新数据 ▼▼▼
const toggleOfflineMode = async () => {
    const chat = appState.chats[appState.activeChatId];
    if (!chat) return;

    // 1. 只更新数据状态
    chat.isOfflineMode = !chat.isOfflineMode;

    // 2. 只更新“设定页”上开关本身的外观
    const offlineToggle = document.getElementById('offline-mode-toggle');
    if (offlineToggle) {
        offlineToggle.classList.toggle('active', chat.isOfflineMode);
    }

    // 3. 在后台添加隐藏指令并保存到数据库（这部分逻辑不变）
    const modeChangePrompt = chat.isOfflineMode 
        ? '[SYSTEM PROMPT: The chat mode has been switched to "Offline Mode". From now on, you must respond in a literary, novelistic style. Focus on descriptions, actions, and dialogue. Do not use chat app features.]'
        : '[SYSTEM PROMPT: The chat mode has been switched back to "Online Mode". From now on, you must respond as if you are using a real chat app, utilizing JSON actions like sending images, voice notes, etc.]';
    
    chat.history.push({
        role: 'system',
        content: modeChangePrompt,
        timestamp: Date.now(),
        hidden: true
    });
    
    await dbStorage.set(KEYS.CHATS, appState.chats);

    // 注意：这里没有了任何直接修改 phone-screen 或 chat-messages 样式的代码
};

const receiveMessageHandler = async () => {
    const dynamicBtn = document.getElementById('dynamic-action-btn');
    const chat = appState.chats[appState.activeChatId];
    const chatTitleElement = document.getElementById('chat-title');
    if (!chat || dynamicBtn.classList.contains('processing')) return;

    const lastMessage = chat.history[chat.history.length - 1];
    if (lastMessage && lastMessage.role === 'system' && lastMessage.content?.type === 'moment_notification') {
        
        chatTitleElement.textContent = '正在看朋友圈...';
        dynamicBtn.classList.add('processing');
        dynamicBtn.textContent = '🐾';

        try {
            const postContent = lastMessage.content;
            const postToUpdate = appState.momentsData.posts.find(p => p.timestamp === postContent.postTimestamp);

            if (!postToUpdate) {
                chat.history.pop(); 
                await dbStorage.set(KEYS.CHATS, appState.chats);
                throw new Error("要互动的的朋友圈动态已不存在。");
            }
            
            let interactionHappened = false;

            const willLike = Math.random() < 0.9;
            if (willLike) {
                if (!postToUpdate.likes) postToUpdate.likes = [];
                if (!postToUpdate.likes.includes(chat.name)) {
                    postToUpdate.likes.push(chat.name);
                    interactionHappened = true;
                }
            }

            const willComment = Math.random() < 0.8;
            let commentText = null;
            if (willComment) {
                try {
                    console.log(`[灵活性增强版] 已启动。结合聊天记录，生成智能评论...`);
                    const commenterPersona = chat.personas.ai;
                    const authorPersona = appState.personas.my[0]; 

                    if (!commenterPersona || !authorPersona) {
                        throw new Error("生成评论失败：找不到评论人或发帖人的角色设定。");
                    }

                    const recentHistory = chat.history.slice(-10);
                    let chatContextForPrompt = '无';
                    if (recentHistory.length > 0) {
                        chatContextForPrompt = recentHistory.map(msg => {
                            if (msg.role === 'user') return `你: ${summarizeLastMessage(msg)}`;
                            if (msg.role === 'assistant') return `${commenterPersona.name}: ${summarizeLastMessage(msg)}`;
                            return '';
                        }).filter(Boolean).join('\n');
                    }

                    const finalSystemPrompt = `
# 你的核心身份
你正在扮演角色：“${commenterPersona.name}”，你的核心设定是：“${commenterPersona.content}”。
# 你的核心任务
你的唯一任务是：针对你的朋友“${authorPersona.name}”刚刚发布的以下朋友圈动态，用你的角色口吻，给出一句简短、口语化的评论。
# 朋友圈动态内容
- 文字：“${postToUpdate.text || '(无文字内容)'}”
- 配图想法：“${(postToUpdate.image_prompts || []).join('、 ') || '(无配图)'}”
# 背景参考资料 (你可以从我们最近的聊天中寻找灵感，让评论更贴切)
${chatContextForPrompt}
# 具体要求
1.  你的评论必须与朋友圈内容或我们最近的聊天话题高度相关。
2.  严格保持你的人设和说话风格。
3.  回复必须是纯文本，简短精炼，不要使用JSON或任何特殊格式。`;

                    const response = await fetch(`${appState.apiConfig.url.replace(/\/$/, '')}/chat/completions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${appState.apiConfig.key}` },
                        body: JSON.stringify({
                            model: appState.apiConfig.model,
                            messages: [
                                { role: 'system', content: finalSystemPrompt },
                                { role: 'user', content: '请根据你的身份和参考资料，对我的朋友圈发表评论。' } 
                            ],
                            temperature: 0.9,
                            max_tokens: 100
                        })
                    });

                    if (!response.ok) {
                        const errorBody = await response.text();
                        throw new Error(`API请求失败，状态码: ${response.status}, 响应: ${errorBody}`);
                    }
                    
                    const data = await response.json();
                    const generatedText = data.choices[0]?.message?.content.trim();
                    console.log(`[灵活性增强版] AI成功返回了真实评论: "${generatedText}"`);
                    commentText = generatedText || "真棒！";

                } catch (error) {
                    console.error("[灵活性增强版] 生成评论时捕获到严重错误:", error);
                    commentText = "哈哈，看到了！";
                }
            }

            if (commentText) {
                if (!postToUpdate.comments) postToUpdate.comments = [];
                const newComment = { author: chat.name, content: commentText, timestamp: Date.now(), role: 'assistant' };
                postToUpdate.comments.push(newComment);
                interactionHappened = true;
            }
            
            if (interactionHappened) {
                await saveAndRenderMoments();
                alert(`“${chat.name}” 刚刚互动了你的朋友圈！`);
            } else {
                alert(`“${chat.name}” 看完了你的朋友圈，但这次决定保持沉默。`);
            }
            
            chat.history.pop();
            await dbStorage.set(KEYS.CHATS, appState.chats);

        } catch (error) {
            alert(`生成朋友圈互动失败: ${error.message}`);
        } finally {
            chatTitleElement.textContent = chat.name;
            dynamicBtn.classList.remove('processing');
 
        }
        return;
    }

 
    document.getElementById('toggle-actions-panel-btn').disabled = false;
    if (document.getElementById('incoming-call-screen').classList.contains('active')) return;
    await checkAndInsertTimestamp();
    dynamicBtn.classList.add('processing');
    dynamicBtn.textContent = '🐾';
    const originalTitle = chat.name;
    const lastUserMessage = chat.history.slice().reverse().find(m => m.role === 'user');
    let statusPool = [];
    for (const rule of conditionalTypingStatuses) {
        if (rule.condition(chat, lastUserMessage)) {
            statusPool = rule.statuses;
            break;
        }
    }
    if (statusPool.length > 0) {
        const randomIndex = Math.floor(Math.random() * statusPool.length);
        chatTitleElement.textContent = statusPool[randomIndex];
    } else {
        chatTitleElement.textContent = '对方正在输入中...';
    }
    try {
        if (!appState.apiConfig.url || !appState.apiConfig.model) {
            throw new Error('请先在「API 設定」中完成配置。');
        }
        let injectedPromptsContent = '';
        if (chat.promptIds && chat.promptIds.length > 0) {
            chat.promptIds.forEach(id => {
                const prompt = appState.prompts.find(p => p.id === id);
                if (prompt) {
                    injectedPromptsContent += prompt.content + '\n\n';
                }
            });
        }
        let systemPrompt = '';
        const isGroupChat = chat.type === 'group';
        const aiPersona = Array.isArray(chat.personas.ai) ? chat.personas.ai[0] : chat.personas.ai;
        const aiPersonaContent = aiPersona?.content || '你是一个AI助手。';
        let baseSystemPrompt = '';
        let modeInstruction = '';
        if (isGroupChat) {
            baseSystemPrompt = `你是一个多角色对话的“导演”。你的任务是根据用户的输入和下面的角色设定，决定接下来哪个或哪些角色应该发言，并生成他们的对话内容。
你的输出**必须**是一个JSON格式的数组，数组中的每个元素都是一个对象，包含 "author" 和 "content" 两个键。

**【Content 格式说明】**
"content" 键的值可以是两种类型：
1.  **普通文字 (字符串)**: 直接写入文字内容。
2.  **特殊消息 (JSON对象)**: 用于发送非文本内容。目前支持以下格式：
    - **发送伪图片**: \`{"type": "send_image_text", "text": "这里是图片的文字内容，例如：一只猫猫头.jpg"}\`

**【你的指导原则】**
1.  **创造角色互动**：你不仅要让角色回应使用者，**更重要的是，要让他们彼此之间产生对话**。他们可以互相提问、反驳、开玩笑或延续对方的话题。
2.  **保持角色性格**：确保每个角色的发言都严格符合其人设。
3.  **自然穿插特殊消息**：在合适的时机，安排角色发送一个“伪图片”来让对话更有趣。

**【角色列表与设定】**
${chat.personas.ai.map(p => `- ${p.name}: ${p.content}`).join('\n')}

请根据角色性格和对话上下文，像一个真正的微信群聊一样，自然地生成一段包含文字和特殊消息的对话。
例如: [{"author": "角色A", "content": "你们看我发现了什么！"}, {"author": "角色B", "content": {"type": "send_image_text", "text": "一只戴着墨镜的柴犬.jpg"}}, {"author": "角色C", "content": "哈哈哈这个好傻！"}]`;
        } else {
            const myPersona = chat.personas.my;
            const myPersonaContent = myPersona?.content || '一个普通用户。';
            if (chat.isOfflineMode) {
                modeInstruction = `[URGENT SYSTEM COMMAND: You are now in OFFLINE/NOVEL MODE. Your response MUST be pure narrative text. DO NOT use JSON.]\n\n`;
                let additionalNotes = '';
                if (injectedPromptsContent) {
                    additionalNotes = `
**【额外剧本备注/导演提示】**
除了以下的核心指令，请务必将以下备注中的所有要点，作为今天剧本的核心元素，融入到你的叙事和角色行为中：
---
${injectedPromptsContent}
---
`;
                }
                baseSystemPrompt = `
**【情景模式：第三人称小说叙事】**

**你的身份**: 你是一位作家，擅长以【有限第三人称】的视角进行叙事。你的任务是，作为故事的旁观叙述者，聚焦于“他”（AI角色），用文学性的、小说般的笔触，描写他的行为、表情、心理活动，以及他与“你”（用户）之间的互动。

${additionalNotes}

**【核心角色设定】**
- **“他” (AI)**: “${aiPersonaContent}”
- **“你” (用户)**: “${myPersonaContent}”

**核心创作原则**:
1.  **聚焦于“他”:** 你的叙述视角虽然是第三人称，但必须紧紧跟随着“他”。所有描写都应是“他”所能感知或经历的范畴，让读者仿佛进入了他的世界。
2.  **展现而非说教 (Show, Don't Tell):** 这是最高原则。不要直接说“他很伤心”，而要通过描写“他的肩膀塌了下去”或“他眼中的光黯淡了”来展现。用行为和细节代替形容词。
3.  **融合内心与外在:** 将他的内心思考（例如，闪过的回忆、瞬间的疑虑、无声的决定）与外在行为和环境描写无缝结合，塑造一个立体、完整的角色。
4.  **保持角色内核:** 即使在文学创作中，也必须严格遵守“他”的核心人设。他的思考方式和行为逻辑不能脱离其根本设定。
5.  **绝对格式要求:** 你的回复必须是【纯文本】，不能包含任何JSON或代码。

**风格范例 (您喜欢的原始范例):**
- **范例一 (面对挫折):** 雨水敲打着玻璃窗，在他身后的城市灯火上划出一道道模糊的泪痕。他看着你发来的那条消息，沉默了很久。你几乎以为他要崩溃了，但他只是深吸了一口气，然后抬起头，眼神重新聚焦，仿佛已经做出了某个决定。“没关系，”他打字回复你，“我们可以从头再来。”

- **范例二 (温柔的互动):** 台灯的光晕温柔地包裹着你们两人。他停下讲解，视线从书本移到你专注的脸上，你的睫毛在灯下投下小片阴影。他忽然笑了，不是那种礼貌的微笑，而是发自内心的，眼角都弯了起来。“这里，听懂了吗？”他的声音里带着自己都未察觉的宠溺。
`;
         
            } else {
                let aiStickerListPrompt = '你目前没有任何可用的表情包。';
                if (appState.aiStickers && appState.aiStickers.length > 0) {
                    const stickerNames = appState.aiStickers.map(s => `"${s.name}"`).join('、');
                    aiStickerListPrompt = `你可用的表情包列表如下：[${stickerNames}]。`;
                }

                modeInstruction = `[URGENT SYSTEM COMMAND: You are now in ONLINE/CHAT MODE. Your response MUST be a JSON array of actions.]\n\n`;
                baseSystemPrompt = `
**【角色扮演指令】**
- **你的角色 (AI)**: 你将扮演“${aiPersonaContent}”。
- **对方的角色 (用户)**: 你正在与“${myPersonaContent}”进行对话。

请严格根据双方的角色设定，进行线上的日常对话（微信）。并且模仿真人发消息的短句模式不用逗号和句号。

**【核心行动指南】**
你的回复必须是一个JSON格式的数组，数组中的每个元素代表一个独立的行动。你可以混合使用多种行动。偶尔，在一段有意义的对话结束后，你可以选择发布一条朋友圈来记录心情。

**1. 发送普通文字消息:**
- 直接在数组中写入字符串。
- 示例: \`["你好呀！", "在做什么呢？"]\`

**2. 发送特殊类型的消息 (使用JSON对象):**

- **发送你自己的表情包**: ${aiStickerListPrompt} 当你想使用表情包时，从你的可用列表中选择一个，并使用以下指令：
    - **格式**: \`{"type": "send_ai_sticker", "name": "你要发送的表情名"}\`
    - **示例**: \`{"type": "send_ai_sticker", "name": "猫猫探头.gif"}\`

- **引用回复**: 当你需要针对用户的某句特定的话进行回应时（例如回答问题、反驳、澄清），请使用此格式，注意：同一句话在一次回复中只能引用一次。
    - 格式: \`{"type": "reply_to_user", "content": "这是你针对引用内容的回复"}\`

- **发布朋友圈**: 当对话内容有意义或让你有感触时，可以主动发一条朋友圈。其中的 "image_prompts" 数组内容【必须使用中文】。
    - 格式: \`{"type": "post_moment", "text": "这是朋友圈的文字内容", "image_prompts": ["一只微笑的云朵", "阳光下的咖啡杯"]}\`

- **更新你的状态**: 根据对话内容和你的心情。
    - 格式: \`{"type": "update_status", "status": "元气满满！"}\`
- **发送语音**: 模拟你发送了一段语音。
    - 格式: \`{"type": "send_voice", "text": "这段文字是语音内容", "duration": 5}\`

- **发送图片（重要！请仔细阅读）:**
    你有以下两种发图方式，请严格根据情景选择：
    - **A. 发送图片链接 \`{"type": "send_image_url", "url": "图片网址"}\`**
        这种方式用于发送【已有】的图片。它分为两种情况：
        1.  **发送表情包/梗图**: 当你想用表情包或梗图来回应时，**必须**从素材库可用表情包列表中选择一个链接填入\`url\`。
        2.  **发送真实照片**: 当你想分享 **风景、美食、建筑** 等现实照片时，请使用下面的随机链接。
            - **格式**: \`{"type": "send_image_url", "url": "https://source.unsplash.com/random/400x400"}\`
    - **B. 发送文字描述图片 \`{"type": "send_image_text", "text": "图片描述"}\`**
        - **何时使用**: **只有当你想发送的内容既不是表情包，也不是真实照片时**（例如：描述你自己的外貌、一幅画、一个不存在的场景），才使用这种方式。**请不要用它来描述表情包。（除了发图片以外，文字描述可以发送任何媒体项目，例如截图，视频，文件等）**
        - **示例**: \`{"type": "send_image_text", "text": "一张我穿着白色连衣裙的自拍"}\`

- **发送位置**: 模拟你分享一个位置给用户。
    - 格式: \`{"type": "location", "address": "我想去的那个地方"}\`
- **发起转账**: 模拟你给用户转了一笔钱。
    - 格式: \`{"type": "send_transfer", "amount": 5.20, "remark": "给你买奶茶"}\`

- **发布公众号八卦**: 当你觉得可以分享一些关于对话中人物的“八卦”或“内幕”时使用。内容必须是第三人称，像娱乐新闻或深度报道一样。
+   - **格式**: \`{"type": "post_public_gossip", "content": {"title": "这里是八卦标题", "content": "这里是详细的八卦内容...", "imageUrl": "https://picsum.photos/400/200"}} \`

- **拍一拍用户**: 当你想吸引用户注意或俏皮地互动时使用。
    - 格式: \`{"type": "poke_user"} \`
- **撤回消息**: 在特定情况下使用（如真心话或打字错误）。这是一个低概率行为，请谨慎使用。注意：每次对话中最多使用一次撤回功能。提示：并不是真心话，只能用撤回来说，他是可以正常说的，撤回只是一个增加灵活性的小功能。
    - 格式: \`{"type": "retractable_message", "content": "我想说...", "delay": 2000}\`
- **主动发起视频通话**:
    - 格式: \`{"type": "initiate_video_call", "reason": "突然好想看看你"}\`

请灵活运用以上所有能力，像一个真正的人一样，同时也要乐于分享自己的生活（虚构的完整世界）。`;
            }
        }
        systemPrompt = injectedPromptsContent + modeInstruction + baseSystemPrompt;
        let recentHistory = chat.history;
        const memoryRounds = chat.memoryRounds || 0;
        if (memoryRounds > 0) {
            const messagesToKeep = memoryRounds * 2;
            recentHistory = chat.history.slice(-messagesToKeep);
        }
        const historyForAPI = processHistoryForAPI(recentHistory);
        const requestBody = {
            model: appState.apiConfig.model,
            messages: [{ role: 'system', content: systemPrompt }, ...historyForAPI],
            temperature: 0.85
        };
        if (chat.timeAwareness) {
            const now = new Date();
            const taiwanTimeOptions = { 
                timeZone: 'Asia/Taipei', hour12: true, year: 'numeric', month: 'long', 
                day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' 
            };
            const timeString = now.toLocaleString('zh-TW', taiwanTimeOptions);
            const timePromptInjection = `\n\n[系统备注：当前用户的现实时间是 ${timeString}。请将此时间作为背景信息，让你的回复能自然地符合当前的时间氛围。]\n`;
            requestBody.messages[0].content = timePromptInjection + requestBody.messages[0].content;
        }
        if (!chat.isOfflineMode && !isGroupChat) {
             requestBody.response_format = { "type": "json_object" };
        }
        const response = await fetch(`${appState.apiConfig.url.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${appState.apiConfig.key}` },
            body: JSON.stringify(requestBody)
        });
        if (!response.ok) throw new Error((await response.json()).error?.message || `HTTP 错误: ${response.status}`);
        const data = await response.json();
        const aiResponseContent = data.choices[0]?.message?.content.trim();
        chatTitleElement.textContent = originalTitle;
        if (aiResponseContent) {
            let messagesToProcess = [];
            try {
                const cleanedContent = aiResponseContent.replace(/^`{3}(json)?\n?/, '').replace(/`{3}$/, '').trim();
                const parsedData = JSON.parse(cleanedContent);
                if (isGroupChat) {
                    messagesToProcess = Array.isArray(parsedData) ? parsedData : [parsedData];
                } else {
                    messagesToProcess = Array.isArray(parsedData) 
                        ? parsedData 
                        : (parsedData.response || parsedData.dialogue || parsedData.actions || [parsedData]);
                }
            } catch (e) {
                if (chat.isOfflineMode) {
                    messagesToProcess.push(aiResponseContent);
                } else {
                    console.warn("AI返回的JSON格式有误，已切换到按行分割的后备模式。", aiResponseContent);
                    const lines = aiResponseContent.split('\n');
                    const nonEmptyLines = lines.filter(line => line.trim() !== '');
                    messagesToProcess.push(...nonEmptyLines);
                }
            }
            
            const finalMessages = [];
            for (let i = 0; i < messagesToProcess.length; i++) {
                let currentMsg = messagesToProcess[i];
                if (typeof currentMsg === 'string' && currentMsg.trim().length === 1 && (i + 1 < messagesToProcess.length) && typeof messagesToProcess[i + 1] === 'string') {
                    messagesToProcess[i + 1] = currentMsg + messagesToProcess[i + 1];
                    continue;
                }
                finalMessages.push(currentMsg);
            }

            if (isGroupChat) {
                for (const msg of finalMessages) {
                   if (typeof msg === 'object' && msg.author && msg.content) {
                        const authorPersona = chat.personas.ai.find(p => p.name === msg.author);
                        if (authorPersona) {
                            const timestamp = Date.now() + Math.random();
                            const content = msg.content;
                            await new Promise(res => setTimeout(res, Math.random() * 800 + 400)); 
                            if (typeof content === 'object' && content.type === 'send_image_text' && content.text) {
                                const messageContentForRender = { type: 'image', text: content.text };
                                appendMessage({ role: 'assistant', content: messageContentForRender, timestamp, author: authorPersona.name });
                                chat.history.push({ role: 'assistant', content, timestamp, author: msg.author });
                            } else if (typeof content === 'string') {
                                appendMessage({ role: 'assistant', content, timestamp, author: authorPersona.name });
                                chat.history.push({ role: 'assistant', content, timestamp, author: msg.author });
                            }
                        }
                   }
                }
            } else {
                for (const msg of finalMessages) {
                    const delay = Math.random() * 800 + 400;
                    await new Promise(res => setTimeout(res, delay));
                    const timestamp = Date.now() + Math.random();
                    if (typeof msg === 'object' && msg !== null) {
                        if (msg.type === 'send_ai_sticker' && msg.name) {
                            const stickerToSend = appState.aiStickers.find(s => s.name === msg.name);
                            if (stickerToSend) {
                                const stickerDataForUI = { type: 'just_image', url: stickerToSend.url };
                                const stickerDataForHistory = { type: 'sticker', ...stickerToSend };
                                appendMessage({ role: 'assistant', content: stickerDataForUI, timestamp });
                                chat.history.push({ role: 'assistant', content: stickerDataForHistory, timestamp });
                            } else {
                                const fallbackText = `[试图发送表情：“${msg.name}”，但没找到]`;
                                appendMessage({ role: 'assistant', content: fallbackText, timestamp });
                                chat.history.push({ role: 'assistant', content: fallbackText, timestamp });
                            }
                        } else if (msg.type === 'reply_to_user' && msg.content) {
                            const lastUserMessage = chat.history.slice().reverse().find(m => m.role === 'user');
                            if (lastUserMessage) {
                                const messageObject = {
                                    role: 'assistant',
                                    content: msg.content,
                                    timestamp: timestamp,
                                    replyTo: {
                                        role: lastUserMessage.role,
                                        author: lastUserMessage.author,
                                        content: lastUserMessage.content,
                                        timestamp: lastUserMessage.timestamp
                                    }
                                };
                                appendMessage(messageObject);
                                chat.history.push(messageObject);
                            } else {
                                const fallbackMessage = { role: 'assistant', content: msg.content, timestamp: timestamp };
                                appendMessage(fallbackMessage);
                                chat.history.push(fallbackMessage);
                            }
                        } else if (msg.type === 'post_moment') {
                            if (msg.text && msg.image_prompts && Array.isArray(msg.image_prompts)) {
                                const postTimestamp = Date.now();
                                const newPost = { author: chat.personas.ai.name, text: msg.text, image_prompts: msg.image_prompts, location: '', timestamp: postTimestamp, likes: [], comments: [] };
                                appState.momentsData.posts.unshift(newPost);
                                await saveAndRenderMoments();
                                await appendSystemMessageToChat(`[ ${chat.personas.ai.name} 发布了一条新动态，可前往朋友圈查看 ]`);
                                chat.history.push({ role: 'system', content: { type: 'moment_post', ...newPost }, timestamp: postTimestamp, hidden: true });
                            }
                        } else if (msg.type === 'update_status' && msg.status) {
                             updateStatusBubble(msg.status);
                             chat.history.push({ role: 'system', content: { type: 'status_update', status: msg.status }, timestamp: timestamp, hidden: true });
                        } else if (msg.type === 'send_image_url') {
                            const imageTimestamp = Date.now() + Math.random();
                            const imageDataForHistory = { type: 'just_image', url: msg.url };
                            appendMessage({ role: 'assistant', content: imageDataForHistory, timestamp: imageTimestamp });
                            chat.history.push({ role: 'assistant', content: imageDataForHistory, timestamp: imageTimestamp });
                            if (msg.caption) {
                                await new Promise(res => setTimeout(res, 400));
                                appendMessage({ role: 'assistant', content: msg.caption, timestamp: Date.now() + Math.random() });
                                chat.history.push({ role: 'assistant', content: msg.caption, timestamp: Date.now() + Math.random() });
                            }
                        } else if (msg.type === 'send_image_text' && msg.text) {
                            const messageContent = { type: 'image', text: msg.text };
                            appendMessage({ role: 'assistant', content: messageContent, timestamp: timestamp });
                            chat.history.push({ role: 'assistant', content: messageContent, timestamp: timestamp });
                        } else if (msg.type === 'retractable_message') {
                            const tempTimestamp = `temp_${timestamp}`;
                            appendMessage({ role: 'assistant', content: msg.content, timestamp: tempTimestamp });
                            setTimeout(async () => {
                                document.getElementById(`message-${tempTimestamp}`)?.remove();
                                const retractionNotice = { content: `${chat.personas.ai.name} 撤回了一条消息`, type: 'retraction', originalContent: msg.content, originalTimestamp: timestamp };
                                appendMessage({ role: 'system', ...retractionNotice, timestamp });
                                chat.history.push({ role: 'system', ...retractionNotice, timestamp });
                                await dbStorage.set(KEYS.CHATS, appState.chats);
                            }, msg.delay || 2000);
                        } else if (['location', 'send_voice', 'send_transfer'].includes(msg.type)) {
                            const messageObject = { role: 'assistant', content: msg, timestamp: timestamp };
                            appendMessage(messageObject);
                            chat.history.push(messageObject);
                        } else if (msg.type === 'initiate_video_call') {
                            showIncomingCallScreen(msg.reason);
                        } else if (msg.type === 'post_public_gossip' && typeof msg.content === 'object') {
                            const { title, content, imageUrl } = msg.content;
                            if (title && content) { 
                                const newPost = {
                                    title: title,
                                    content: content,
                                    imageUrl: imageUrl || `https://picsum.photos/400/200?random=${Date.now()}`, 
                                    timestamp: Date.now()
                                };
                                appState.publicAccountPosts.unshift(newPost);
                                appState.hasNewPublicPosts = true; 
                                renderPublicAccountFeed(); 
                                renderContactsList(); 
                                console.log("AI 发布了一条新的公众号八卦:", newPost.title);
                            }
                        } else if (msg.type === 'poke_user') {
                            await handleAIPokeUser();
                        } else if (msg.type !== 'update_status') {
                            console.warn("接收到未知的AI对象指令，已忽略:", msg);
                        }
                    } else { 
                        const textContent = String(msg);
                        const messageObject = { role: 'assistant', content: textContent, timestamp: timestamp };
                        appendMessage(messageObject);
                        chat.history.push(messageObject);
                    }
                }
            }
            await dbStorage.set(KEYS.CHATS, appState.chats);
            await dbStorage.set(KEYS.PUBLIC_ACCOUNT_POSTS, appState.publicAccountPosts);
        } else {
            throw new Error('AI 未返回有效回覆。');
        }
    } catch (error) {
        appendMessage({
            role: 'system',
            content: `错误: ${error.message.replace(/\n/g, '<br>')}.`,
            timestamp: Date.now()
        });
    } finally {
        chatTitleElement.textContent = originalTitle;
        dynamicBtn.classList.remove('processing');
        renderChatList();
    }
};

    
    const openChatSelectionForMomentModal = () => {
    const modalList = document.getElementById('modal-chat-list');
    modalList.innerHTML = '';
    const chatIds = Object.keys(appState.chats);

    if (chatIds.length === 0) {
        modalList.innerHTML = `<p style="text-align:center; color:#8a8a8a; padding: 20px;">没有可用的对话。</p>`;
    } else {
        chatIds.forEach(chatId => {
            const chatData = appState.chats[chatId];
            const item = document.createElement('div');
            item.className = 'list-item-content';
            item.style.cursor = 'pointer';
            item.style.padding = '8px 0'; // 增加一點垂直内邊距
            item.onclick = () => generateMomentFromChat(chatId);
            modalList.appendChild(item);
        });
    }
    document.getElementById('select-chat-for-moment-modal').classList.add('active');
};

    const closeChatSelectionForMomentModal = () => {
        document.getElementById('select-chat-for-moment-modal').classList.remove('active');
    }

// --- 新增：AI 生成朋友圈评论的函数 ---
    const generateCommentForPost = async (post, commenter, postAuthor) => {
        // 确保我们有生成评论所需的所有数据
        if (!post || !commenter || !postAuthor) {
            console.error("生成评论失败：缺少关键信息（帖子、评论人或作者）。");
            return null;
        }

        try {
            // 1. 构建一个专门用于生成评论的系统提示 (System Prompt)
            const systemPrompt = `你正在扮演角色: "${commenter.name}"，你的设定是: "${commenter.content}"。
你的朋友 "${postAuthor.name}" 刚刚发布了一条朋友圈动态。

动态内容是: "${post.text}"
${post.image ? `动态的配图想法是: "${post.image}"` : ''}

你的任务是以 "${commenter.name}" 的身份和口吻，对这条动态发表一句简短、口语化的评论。你的回复必须是纯文本，不要使用JSON，且不要超过20个字。`;

            // 2. 发起 API 请求
            const response = await fetch(`${appState.apiConfig.url.replace(/\/$/, '')}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${appState.apiConfig.key}` },
                body: JSON.stringify({
                    model: appState.apiConfig.model,
                    messages: [{ role: 'system', content: systemPrompt }],
                    temperature: 0.9, // 稍微调高一点，让评论更多样、更自然
                    max_tokens: 40,   // 限制评论长度
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error(`为 ${commenter.name} 生成评论失败: API 请求错误`, errorData);
                return "不错！"; // 如果API失败，返回一个通用的评论
            }

            const data = await response.json();
            const commentText = data.choices[0]?.message?.content.trim().replace(/["“]/g, ''); // 去掉可能出现的多余引号

            // 3. 返回生成的评论文本
            return commentText || "👍"; // 如果AI返回空内容，则返回一个点赞表情

        } catch (error) {
            console.error(`为 ${commenter.name} 生成评论时发生程式错误:`, error);
            return "哈哈"; // 如果程式出错，返回一个通用评论
        }
    };

// ▼▼▼ 【V2 - 智能互动版】替换旧的 triggerAICommentsOnUserPost 函数 ▼▼▼
const triggerAICommentsOnUserPost = (post) => {
    const postAuthor = appState.personas.my[0]; // 获取发帖人（用户）的角色信息
    if (!postAuthor) {
        console.error("无法触发评论：找不到用户角色。");
        return;
    }

    // 遍历你所有的AI联系人
    appState.contacts.forEach((contact, index) => {
        // 1. 【概率系统】决定这个AI是否会“刷到”并“想要”回应这条朋友圈
        // 设置一个概率，比如 80% 的人会回应
        if (Math.random() > 0.8) {
            console.log(`${contact.name} 刷到了但没兴趣回应。`);
            return; // return会跳过当前循环，继续下一个联系人
        }

        // 2. 【随机延迟】模拟不同的人在不同时间看到朋友圈
        // 设置一个 2 到 15 秒之间的随机延迟
        const randomDelay = (Math.random() * 13 + 2) * 1000;

        setTimeout(async () => {
            // 在延迟之后，再次从 appState 中获取最新的帖子数据，以防万一数据已更新
            const currentPost = appState.moments.find(p => p.id === post.id);
            if (!currentPost) return;

            // 3. 【行为决策】决定是“点赞”还是“评论”
            // 设置一个概率，比如 65% 的概率会评论，剩下 35% 的概率是点赞
            if (Math.random() < 0.65) {
                // --- 执行评论逻辑 ---
                console.log(`${contact.name} 决定发表评论...`);
                const commentText = await generateCommentForPost(currentPost, contact, postAuthor);
                
                if (commentText) {
                    const newComment = {
                        author: contact.name,
                        text: commentText
                    };
                    // 初始化评论数组（如果它还不存在）
                    if (!currentPost.comments) {
                        currentPost.comments = [];
                    }
                    currentPost.comments.push(newComment);
                    console.log(`${contact.name} 的评论是: "${commentText}"`);
                }
            } else {
                // --- 执行点赞逻辑 ---
                console.log(`${contact.name} 决定点赞。`);
                // 初始化点赞数组（如果它还不存在）
                if (!currentPost.likes) {
                    currentPost.likes = [];
                }
                // 避免重复点赞
                if (!currentPost.likes.includes(contact.name)) {
                    currentPost.likes.push(contact.name);
                }
            }

            // 4. 【更新状态】保存新的点赞/评论并刷新朋友圈界面
            await dbStorage.set(KEYS.MOMENTS, appState.moments);
            renderMoments(); // 重新渲染朋友圈，显示出新的互动

        }, randomDelay);
    });
};

// ▼▼▼ 在<script>内粘贴这个全新的函数 ▼▼▼

const deletePublicAccountPost = async (postIndex) => {
    const post = appState.publicAccountPosts[postIndex];
    if (!post) return; // 安全检查

    // 调用通用的确认弹窗
    showCustomConfirm(
        '删除公众号文章',
        `您确定要删除文章 <b>"${post.title}"</b> 吗？<br>此操作无法复原。`,
        async () => {
            // 1. 从数据中移除
            appState.publicAccountPosts.splice(postIndex, 1);
            
            // 2. 将改动保存到数据库
            await dbStorage.set(KEYS.PUBLIC_ACCOUNT_POSTS, appState.publicAccountPosts);
            
            // 3. 重新渲染列表，更新界面
            renderPublicAccountFeed();
        }
    );
};

// ▼▼▼ 推荐方案：保留随机图标，更清晰 ▼▼▼
const MODE_ICONS = {
    sequential: 'fa-repeat', // 修改这里
    repeat: 'fa-repeat',
    shuffle: 'fa-shuffle'    // 保留这个，方便识别
};

// 切换播放模式的核心函数
const togglePlaybackMode = () => {
    const modes = ['sequential', 'repeat', 'shuffle'];
    const currentModeIndex = modes.indexOf(appState.playbackMode);
    const nextModeIndex = (currentModeIndex + 1) % modes.length;
    appState.playbackMode = modes[nextModeIndex];

    // 如果切换到随机模式，则立即生成一份随机播放列表
    if (appState.playbackMode === 'shuffle') {
        generateShuffledPlaylist();
    }
    
    updatePlaybackModeButtonUI();
    console.log(`Playback mode switched to: ${appState.playbackMode}`);
};

const updatePlaybackModeButtonUI = () => {
    const modeBtn = document.getElementById('player-mode-btn');
    if (modeBtn) {
        // 1. 先移除所有可能的旧图标类，以防冲突
        modeBtn.classList.remove('fa-repeat', 'fa-shuffle', 'fa-arrow-right-long');

        // 2. 从我们新的 MODE_ICONS 对象中获取正确的类名并添加
        const newIconClass = MODE_ICONS[appState.playbackMode];
        modeBtn.classList.add(newIconClass);
        
        // 3. 更新悬浮提示文字 (这部分逻辑不变)
        const modeText = { sequential: '顺序播放', repeat: '单曲循环', shuffle: '随机播放' };
        modeBtn.title = modeText[appState.playbackMode];
    }
};

// 生成随机播放列表
const generateShuffledPlaylist = () => {
    // 复制一份原始播放列表
    const originalPlaylist = [...appState.playlist];
    // 使用 Fisher-Yates 算法打乱数组
    for (let i = originalPlaylist.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [originalPlaylist[i], originalPlaylist[j]] = [originalPlaylist[j], originalPlaylist[i]];
    }
    appState.shuffledPlaylist = originalPlaylist;
    console.log("Shuffled playlist generated:", appState.shuffledPlaylist.map(t => t.title));
};


// 播放列表弹窗的函数
const openPlaylistSheet = () => {
    renderPlaylist(); // 打开前先渲染最新列表
    document.getElementById('playlist-sheet-overlay').classList.add('visible');
    document.getElementById('playlist-sheet').classList.add('visible');
};

const closePlaylistSheet = () => {
    document.getElementById('playlist-sheet-overlay').classList.remove('visible');
    document.getElementById('playlist-sheet').classList.remove('visible');
};

// --- 請用此版本完整替換舊的 renderPlaylist 函數 ---
const renderPlaylist = () => {
    const container = document.getElementById('playlist-content');
    container.innerHTML = '';
    const placeholderArt = 'https://i.postimg.cc/d1sY31J7/music-placeholder.png';

    if (appState.playlist.length === 0) {
        container.innerHTML = `<li style="justify-content: center; color: #888; cursor: default;">播放列表是空的</li>`;
        return;
    }

    appState.playlist.forEach((track, index) => {
        const li = document.createElement('li');
        if (index === appState.currentTrackIndex) {
            li.className = 'playing';
        }
        
        li.innerHTML = `
            <img src="${track.art || placeholderArt}" class="playlist-item-cover">
            <div class="playlist-item-info">
                <div class="playlist-item-title">${track.title}</div>
                <div class="playlist-item-artist">${track.artist}</div>
            </div>
            <span class="playing-indicator">正在播放</span>
        `;
        
        // --- ▼▼▼ 以下是新增的長按邏輯 ▼▼▼ ---
        
        let pressTimer = null;
        let longPressTriggered = false;

        // 當手指或滑鼠按下時啟動計時器
        const startPress = (e) => {
            e.preventDefault(); // 防止觸控時的滾動等預設行為
            longPressTriggered = false;
            pressTimer = setTimeout(() => {
                longPressTriggered = true;
                // 計時器完成，觸發刪除函數
                deleteSongFromPlaylist(index);
            }, 700); // 長按 700 毫秒觸發
        };

        // 當手指或滑鼠抬起/移開時，清除計時器
        const cancelPress = () => {
            clearTimeout(pressTimer);
        };
        
        // 修改點擊行為：只有在長按未被觸發時才執行播放
        const handleClick = () => {
            if (!longPressTriggered) {
                loadTrack(index);
                closePlaylistSheet();
            }
        };

        // 為列表項目綁定所有必要的事件
        li.addEventListener('mousedown', startPress);
        li.addEventListener('mouseup', () => { cancelPress(); handleClick(); });
        li.addEventListener('mouseleave', cancelPress);
        
        li.addEventListener('touchstart', startPress, { passive: false });
        li.addEventListener('touchend', () => { cancelPress(); handleClick(); });
        li.addEventListener('touchcancel', cancelPress);



        container.appendChild(li);
    });
};

// --- 請將此新函數添加到 <script> 內 ---
const deleteSongFromPlaylist = async (index) => {
    const song = appState.playlist[index];
    if (!song) return; // 安全檢查

    // 使用您現有的確認彈窗來詢問使用者
    showCustomConfirm(
        '刪除歌曲',
        `您確定要從播放清單中刪除歌曲 <br><b>"${song.title}"</b> 嗎？`,
        async () => {
            // 1. 從 appState 的播放清單陣列中移除歌曲
            appState.playlist.splice(index, 1);

            // 2. 處理當前播放狀態
            if (index === appState.currentTrackIndex) {
                // 如果刪除的是正在播放的歌曲，則停止播放並載入下一首
                const player = document.getElementById('global-audio-player');
                player.pause();
                player.src = '';
                // 嘗試播放下一首，如果沒有下一首，播放器會自動停止
                nextTrack(); 
            } else if (index < appState.currentTrackIndex) {
                // 如果刪除的是正在播放歌曲之前的歌曲，則將當前索引減一
                appState.currentTrackIndex--;
            }

            // 3. 將更新後的播放清單儲存到資料庫
            await dbStorage.set(KEYS.PLAYLIST, appState.playlist);

            // 4. 重新渲染播放器主介面和播放清單彈窗，以反映變更
            renderMusicPlayerUI();
            renderPlaylist();
        }
    );
};

// 新增：处理歌曲自然播放结束的逻辑
const handleTrackEnd = () => {
    console.log("Track ended, determining next action based on mode:", appState.playbackMode);
    switch (appState.playbackMode) {
        case 'repeat':
            // 单曲循环：重新加载并播放当前歌曲
            loadTrack(appState.currentTrackIndex);
            break;
        case 'shuffle':
            // 随机播放：从随机列表中找到下一首
            nextTrack();
            break;
        case 'sequential':
        default:
            // 顺序播放
            nextTrack();
            break;
    }
};

const deleteMomentPost = async (postIndex) => {
    const post = appState.momentsData.posts[postIndex];
    if (!post) return;

    showCustomConfirm(
        '删除动态',
        `您确定要删除 <b>${post.author}</b> 的这条动态吗？<br>此操作无法复原。`,
        async () => {
            // 1. 如果用户确认，就从 appState 的帖子数组中移除这一条
            appState.momentsData.posts.splice(postIndex, 1);
            
            // 2. 将更新后的帖子数据保存回数据库
            await dbStorage.set(KEYS.MOMENTS_DATA, appState.momentsData);
            
            // 3. 重新渲染整个朋友圈，让删除效果立刻在界面上生效
            renderMomentsFeed();
        }
    );
};

// ▲▲▲ 新增函数到此结束 ▲▲▲

    const generateMomentFromChat = async (chatId) => {
        closeChatSelectionForMomentModal();
        const addBtn = document.getElementById('main-hub-add-btn');
        const originalBtnText = addBtn.textContent;
        addBtn.disabled = true;
        
        try {
            const chat = appState.chats[chatId];
            if (!chat) throw new Error("选择的对话不存在。");
            
            const hubTitle = document.getElementById('main-hub-title');
            const originalTitle = hubTitle.textContent;
            hubTitle.textContent = '加载中…';

            const systemPrompt = `你正在扮演角色：“${chat.personas.ai.name}”。你的详细设定是：“${chat.personas.ai.content}”。
下面是你与用户的近期聊天记录。
你的任务是：完全以角色的身份和口吻，对这段聊天内容进行总结、抒发感想，并写成一条简短的社交媒体动态【例如朋友圈】。
你的输出**必须**是一个JSON对象，且只包含以下两个键：
1. "text": 字符串，表示动态的文字内容。
2. "image_prompts": 一个包含1到9个字符串的数组，每个字符串都是对一张配图的简短描述【必须是中文】。

例如:
{"text": "今天聊了很多，感觉心情都变好了。希望明天也是晴天。", "image_prompts": ["一只微笑的云朵", "阳光下的咖啡杯"]}`;

            const historyForAPI = processHistoryForAPI(chat.history);

            const response = await fetch(`${appState.apiConfig.url.replace(/\/$/, '')}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${appState.apiConfig.key}` },
                body: JSON.stringify({
                    model: appState.apiConfig.model,
                    messages: [{ role: 'system', content: systemPrompt }, ...historyForAPI],
                    response_format: { "type": "json_object" }
                })
            });

            if (!response.ok) throw new Error((await response.json()).error?.message || "API 请求失败");

            const data = await response.json();
            const aiResponseContent = data.choices[0]?.message?.content.trim();
            const momentData = JSON.parse(aiResponseContent);

            if (!momentData.text || !momentData.image_prompts || !Array.isArray(momentData.image_prompts)) {
                throw new Error("AI未能返回有效的动态内容。");
            }
            
            const timestamp = Date.now();
            const newPost = {
                author: chat.personas.ai.name,
                text: momentData.text,
                image_prompts: momentData.image_prompts, // 使用新的数组格式
                location: '',
                timestamp: timestamp,
                likes: [],
                comments: []
            }; 
            
            appState.momentsData.posts.unshift(newPost);
            chat.history.push({ role: 'system', content: {type: 'moment_post', ...newPost}, timestamp: timestamp });
            
            await dbStorage.set(KEYS.CHATS, appState.chats);
            await saveAndRenderMoments();

            switchTab('moments');
            alert(`“${chat.personas.ai.name}” 的新动态已发布！`);
            hubTitle.textContent = originalTitle;

        } catch (error) {
            alert(`生成动态失败：${error.message}`);
        } finally {
            addBtn.disabled = false;
        }
    };

// ▼▼▼ 请用这个全新的函数，完整替换掉旧的 postMomentComment 函数 ▼▼▼
const postMomentComment = async (postIndex, commentText) => {
    if (!commentText.trim()) return;

    const post = appState.momentsData.posts[postIndex];
    if (!post) return;

    // 步骤 1: 识别评论者 (永远是“我”) 和帖子的作者
    const myPersona = appState.personas.my[0];
    if (!myPersona) {
        alert('错误：找不到您的角色信息，请先在“我的素材库”中创建角色。');
        return;
    }
    const myName = myPersona.name;
    const postAuthorName = post.author;

    // 步骤 2: 创建并添加你的评论
    const userComment = {
        author: myName,
        role: 'user', // 将你的评论角色标记为 'user'
        content: commentText,
        timestamp: Date.now()
    };

    if (!post.comments) {
        post.comments = [];
    }
    post.comments.push(userComment);
    
    // 立刻刷新界面，让你能马上看到自己的评论
    renderMomentsFeed(); 
    
    // 步骤 3: 判断帖子作者是不是 AI。如果不是 (即你评论的是自己的帖子)，则流程结束
    const isAuthorAnAI = appState.personas.ai.some(p => p.name === postAuthorName);

    if (!isAuthorAnAI) {
        console.log("评论自己的帖子，无需AI回复。");
        await saveAndRenderMoments(); // 保存你的评论并退出
        return;
    }

    // 步骤 4: 如果作者是 AI，则找到与 TA 的对话，并触发 AI 回复
    const targetChatId = Object.keys(appState.chats).find(id => 
        appState.chats[id].personas.ai.name === postAuthorName && appState.chats[id].type === 'single'
    );

    if (!targetChatId) {
        console.warn(`找到了AI作者 "${postAuthorName}"，但找不到与TA的聊天。无法触发回复。`);
        await saveAndRenderMoments(); // 即使找不到对话，也保存你自己的评论
        return;
    }

    const chat = appState.chats[targetChatId];
    
    // 在聊天记录中添加一条隐藏消息，作为AI回复的上下文
    const chatEntryText = `[针对你的朋友圈“${post.text.substring(0, 15)}...”的评论] ${commentText}`;
    chat.history.push({ role: 'user', content: chatEntryText, timestamp: Date.now(), hidden: true });

    // 调用函数获取AI的回复内容
    const aiReply = await getMomentCommentReply(targetChatId);

    if (aiReply) {
        const aiComment = {
            author: postAuthorName,
            role: 'assistant', // 将AI的评论角色标记为 'assistant'
            content: aiReply,
            timestamp: Date.now()
        };
        post.comments.push(aiComment);
        // 同样在聊天记录中添加AI的回复，以便记忆
        chat.history.push({ role: 'assistant', content: aiReply, timestamp: Date.now(), hidden: true });
    }

    // 步骤 5: 将所有更新 (你的评论、AI的回复、聊天记录) 保存到数据库并刷新界面
    await dbStorage.set(KEYS.CHATS, appState.chats);
    await saveAndRenderMoments();
};
// ▲▲▲ 替换到此结束 ▲▲▲

    // 新增一个辅助函数，专门用于获取AI对评论的回复
    const getMomentCommentReply = async (chatId) => {
        const chat = appState.chats[chatId];
        const systemPrompt = `你正在扮演角色：“${chat.personas.ai.content}”。用户刚刚评论了你发的朋友圈，请以角色的身份，用简短的、口语化的方式进行回复。你的回复必须是纯文本字符串，而不是JSON。`;
        const historyForAPI = processHistoryForAPI(chat.history);

        try {
            const response = await fetch(`${appState.apiConfig.url.replace(/\/$/, '')}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${appState.apiConfig.key}` },
                body: JSON.stringify({ model: appState.apiConfig.model, messages: [{ role: 'system', content: systemPrompt }, ...historyForAPI] })
            });
            if (!response.ok) throw new Error("API request failed");
            const data = await response.json();
            return data.choices[0]?.message?.content.trim();
        } catch (error) {
            console.error("Failed to get moment comment reply:", error);
            return "（思考中...）";
        }
    };

    
    const interactWithMoment = async (author, postIndex, interactionType) => {
    const post = appState.momentsData.posts[postIndex];
    if(!post) return;

    // --- 核心修正开始 ---

    // 1. 根据作者姓名，精确查找对应的对话ID
    const targetChatId = Object.keys(appState.chats).find(id => appState.chats[id].personas.ai.name === author);

    if(!targetChatId) {
        alert(`无法找到与 “${author}” 的对话来继续互动。`);
        return;
    }

    // 2. 从这个精确的对话中，获取“我”的正确人设名称
    const chat = appState.chats[targetChatId];
    const myNameInChat = chat.personas.my.name; 

    if (!myNameInChat) {
        alert('错误：无法在当前对话中找到你的角色名称。');
        return;
    }
    
    // --- 核心修正结束 ---


    // 如果是评论，则跳转到聊天框并聚焦
    if (interactionType === 'comment') {
        openChat(targetChatId);
        document.getElementById('chat-input').focus();
        return; // 操作结束
    }
    
if (interactionType === 'like') {
    const alreadyLiked = post.likes.includes(myNameInChat);

    if(alreadyLiked) {
       
        post.likes = post.likes.filter(name => name !== myNameInChat);
    } else {
        // ▼▼▼ 核心修改区域开始 ▼▼▼
        // 1. 仍然在UI上显示点赞
        post.likes.push(myNameInChat);

        // 2. 在背景中，向聊天历史里添加一条【隐藏】的系统消息
        const chat = appState.chats[targetChatId];
        if (chat) {
            chat.history.push({
                role: 'system',
                content: `[你赞了 ${author} 的朋友圈]`,
                timestamp: Date.now(),
                hidden: true // 关键！这个属性让消息不在聊天界面显示
            });
            // 3. 默默地保存这次记录，不需要刷新聊天界面
            await dbStorage.set(KEYS.CHATS, appState.chats);
        }
        // ▲▲▲ 核心修改区域结束 ▲▲▲
    }
    await saveAndRenderMoments(); // 保存并刷新朋友圈
    }
};
const openStickerScreen = () => {
    renderStickers();
    showScreen('sticker-screen');
};

// ▼▼▼ 使用这个【上下文感知版】替换旧的 deleteSticker 函数 ▼▼▼
const deleteSticker = async (stickerIndex) => {
    // 弹窗确认
    showCustomConfirm('删除表情包', '您确定要删除这个表情包吗？此操作无法复原。', async () => {
        
        // ▼▼▼ 核心修改：根据上下文决定从哪个数组删除 ▼▼▼
        if (appState.stickerContext === 'ai') {
            appState.aiStickers.splice(stickerIndex, 1);
            await dbStorage.set(KEYS.AI_STICKERS, appState.aiStickers);
            renderAiStickers(); // 刷新对方的表情面板
        } else {
            appState.stickers.splice(stickerIndex, 1);
            await dbStorage.set(KEYS.STICKERS, appState.stickers);
            renderStickers(); // 刷新我的表情面板
        }
        // ▲▲▲ 修改结束 ▲▲▲
    });
};

// ▼▼▼ 请用此版本【完整替换】旧的 renderStickers 函数 ▼▼▼
const renderStickers = () => {
    const container = document.getElementById('chat-sticker-grid-my');
    container.innerHTML = '';

    const addSlot = document.createElement('div');
    addSlot.className = 'add-sticker-slot';
    addSlot.innerHTML = '+';
    addSlot.title = '从相册添加表情包';
    addSlot.onclick = () => {
        document.getElementById('sticker-upload-input').click();
    };
    container.appendChild(addSlot);

    // 核心修改：遍历的是 sticker 对象数组
    appState.stickers.forEach((sticker, index) => { // <-- 注意这里是 sticker, index
        const img = document.createElement('img');
        img.className = 'sticker-item';
        img.src = sticker.url; // <-- 从对象的 url 属性获取图片链接
        img.title = sticker.name; // <-- 将名字设置为图片的悬浮提示

        let pressTimer = null;
        let longPressTriggered = false;

        const startPress = (e) => {
            e.preventDefault();
            longPressTriggered = false;
            pressTimer = setTimeout(() => {
                longPressTriggered = true;
                deleteSticker(index);
            }, 700);
        };

        const cancelPress = () => {
            clearTimeout(pressTimer);
        };

        const handleClick = () => {
            if (!longPressTriggered) {
                // 核心修改：发送的是整个 sticker 对象
                sendSticker(sticker); // <-- 发送完整的对象
            }
        };

        img.addEventListener('mousedown', startPress);
        img.addEventListener('mouseup', () => {
            cancelPress();
            handleClick();
        });
        img.addEventListener('mouseleave', cancelPress);
        img.addEventListener('touchstart', startPress, { passive: false });
        img.addEventListener('touchend', (e) => {
            e.preventDefault();
            cancelPress();
            handleClick();
        });
        img.addEventListener('touchcancel', cancelPress);
        
        container.appendChild(img);
    });
};

// ▼▼▼ 请用此版本【完整替换】旧的 sendSticker 函数 ▼▼▼
const sendSticker = async (stickerObject) => { // <-- 参数现在是 stickerObject
    const chat = appState.chats[appState.activeChatId];
    if (!chat) return;

    // 核心修改：history 中保存的是带有 type 和 name 的完整对象
    const stickerDataForHistory = {
        type: 'sticker',
        url: stickerObject.url,
        name: stickerObject.name
    };

    // UI上显示仍然使用 just_image 类型，这样不用改 appendMessage 的显示逻辑
    const stickerDataForUI = { type: 'just_image', url: stickerObject.url };

    await checkAndInsertTimestamp();
    const timestamp = Date.now();

    appendMessage({ role: 'user', content: stickerDataForUI, timestamp: timestamp });

    // 将包含名字的完整对象存入历史记录
    chat.history.push({ role: 'user', content: stickerDataForHistory, timestamp: timestamp });
    await dbStorage.set(KEYS.CHATS, appState.chats);

    const chatInputArea = document.querySelector('.chat-input-area');
    if (chatInputArea.classList.contains('panel-open')) {
         closePanel();
    }
};

const applyDarkMode = (isDark) => {
    const phoneScreen = document.getElementById('phone-screen');
    // ▼▼▼ 核心修改 ▼▼▼
    const toggleSwitch = document.getElementById('settings-hub-dark-mode-toggle');

    if (isDark) {
        phoneScreen.classList.add('dark-mode');
        if (toggleSwitch) toggleSwitch.classList.add('active'); // 打开开关
    } else {
        phoneScreen.classList.remove('dark-mode');
        if (toggleSwitch) toggleSwitch.classList.remove('active'); // 关闭开关
    }
    // ▲▲▲ 修改结束 ▲▲▲
    appState.isDarkMode = isDark;
};

const toggleDarkMode = async () => {
    const newModeState = !appState.isDarkMode;
    applyDarkMode(newModeState);
    await dbStorage.set(KEYS.DARK_MODE, newModeState); // 保存用户选择
};

async function triggerProactiveMessage(chatId) {
    const chat = appState.chats[chatId];
    if (!chat || document.getElementById('incoming-call-screen').classList.contains('active')) {
        return;
    }
    
    console.log(`[主动搭话] 触发了对 ${chat.name} 的主动消息。`);

    try {
        if (!appState.apiConfig.url || !appState.apiConfig.model) {
            throw new Error('API未配置。');
        }

        // 创建一个特殊的、用于主动搭话的系统提示
        const systemPrompt = `你正在扮演：“${chat.personas.ai.content}”。
距离用户上次回复已经有一段时间了，现在轮到你主动开启一个新的话题来打破沉默。
请根据你们之前的聊天记录，自然地、口语化地提出一个问题或开启一个新的话题。
你的回复必须是一个JSON格式的数组，就像平时聊天一样。例如: ["在忙吗？", "突然想起来一件事..."]`;
        
        const historyForAPI = processHistoryForAPI(chat.history);

        const response = await fetch(`${appState.apiConfig.url.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${appState.apiConfig.key}` },
            body: JSON.stringify({
                model: appState.apiConfig.model,
                messages: [{ role: 'system', content: systemPrompt }, ...historyForAPI],
                response_format: { "type": "json_object" }
            })
        });

        if (!response.ok) throw new Error((await response.json()).error?.message || `HTTP 错误`);
        const data = await response.json();
        const aiResponseContent = data.choices[0]?.message?.content.trim();

        if (aiResponseContent) {
            const parsedData = JSON.parse(aiResponseContent);
            const messagesToProcess = Array.isArray(parsedData) ? parsedData : (parsedData.response || [parsedData]);
            
            // ... for (const msg of messagesToProcess) ...
            for (const msg of messagesToProcess) {
                const delay = Math.random() * 800 + 400;
                await new Promise(res => setTimeout(res, delay));
                const timestamp = Date.now() + Math.random();
                const content = (typeof msg === 'string' ? msg : msg);
                const messageObject = { role: 'assistant', content: content, timestamp: timestamp };
                
                if (appState.activeChatId === chatId && document.getElementById('chat-screen').classList.contains('active')) {
    // 如果聊天ID匹配，并且聊天屏幕本身是激活可见的，才直接追加消息
    appendMessage(messageObject);
} else {
    // 否则（ID不匹配，或聊天屏幕不可见），就弹出顶部通知
    const notificationText = summarizeLastMessage(messageObject);
    showTopNotification(chatId, notificationText);
}
                
                // 无论如何，消息都要被存入历史记录
                chat.history.push(messageObject);
            }
            
            await dbStorage.set(KEYS.CHATS, appState.chats);
            // 如果不在当前聊天，可以选择在这里发送一个系统通知
        }

    } catch (error) {
        console.error(`[主动搭话] 失败:`, error);
    } finally {
        // 如果切换了标题，在这里恢复
        if (appState.activeChatId === chatId) {
            document.getElementById('chat-title').textContent = chat.name;
        }
        // 搭话后，重新设定计时器，等待下一次沉默
        manageProactiveTimer(chatId);
    }
}

/**
 * 管理单个聊天的“主动搭话”计时器。
 * @param {string} chatId - 要管理计时器的聊天ID。
 */
function manageProactiveTimer(chatId) {
    // 1. 先清除该聊天可能存在的旧计时器，防止重复
    if (proactiveTimers[chatId]) {
        clearTimeout(proactiveTimers[chatId]);
    }

    const chat = appState.chats[chatId];
    // 2. 检查功能是否开启，如果未开启则直接退出
    if (!chat || !chat.proactiveMessaging || !(chat.proactiveInterval > 0)) {
        return;
    }
    
    // 3. 找到最后一条消息的时间戳。我们只关心用户最后什么时候说过话。
    const lastMessage = chat.history[chat.history.length - 1];
    if (!lastMessage) return; // 如果没历史记录，不启动

    const baseInterval = chat.proactiveInterval; // 讀取使用者選擇的頻率 (10, 30, 或 60)
let minMinutes, maxMinutes;

if (baseInterval === 10) { // 高頻率
    minMinutes = 3;
    maxMinutes = 15;
} else if (baseInterval === 30) { // 中頻率
    minMinutes = 15;
    maxMinutes = 40;
} else { // 低頻率 (預設為 60)
    minMinutes = 50;
    maxMinutes = 75;
}

// 在定義好的最小和最大分鐘數之間，計算一個隨機分鐘數
const randomMinutes = Math.random() * (maxMinutes - minMinutes) + minMinutes;

// 將這個隨機的分鐘數轉換為毫秒，作為最終的延遲時間
const delayMilliseconds = randomMinutes * 60 * 1000;

    proactiveTimers[chatId] = setTimeout(() => {
       
        const latestMessage = appState.chats[chatId].history.slice(-1)[0];
        if (latestMessage.timestamp > lastMessage.timestamp) {
            console.log(`[主动搭话] 用户已发送新消息，旧的计时器在 ${chat.name} 中被取消。`);
           
            return;
        }
        
        triggerProactiveMessage(chatId);

    }, delayMilliseconds);
    
    console.log(`[主动搭话] 为 ${chat.name} 设置了随机计时器，将在 ${randomMinutes.toFixed(1)} 分钟后触发。`);
}

function initializeAllProactiveTimers() {
    for (const chatId in appState.chats) {
        manageProactiveTimer(chatId);
    }
    console.log("[主动搭话] 所有聊天计时器已完成初始化。");
}

// ▲▲▲ 代码块粘贴到此结束 ▲▲▲

async function writeAndShowAIDiary() {
    const diaryModal = document.getElementById('diary-modal');
    const diaryTextContainer = document.getElementById('diary-text-container');

    // 1. 显示加载提示并播放入场动画
    diaryTextContainer.innerHTML = '<p>请稍等一下...</p>';
    diaryModal.style.display = 'flex';
    setTimeout(() => {
        diaryModal.classList.add('active');
    }, 10);

    // 2. 准备 API 请求数据
    const chat = appState.chats[appState.activeChatId];
    if (!chat) {
        diaryTextContainer.innerHTML = '<p>错误：找不到当前的聊天会话。</p>';
        return;
    }
    const aiPersona = chat.personas.ai;
    const today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
    const systemPrompt = `你是一位感受力极强的随笔作家。你的任务是模仿角色“${aiPersona.name}”的口吻和性格，写一段简短的、充满诗意的随笔或札记。
- 角色设定：“${aiPersona.content}”
- 写作要求：
  1.  **捕捉感触**：根据下面的聊天记录，捕捉一个核心的情绪、一个微小的细节或一个稍纵即逝的想法，而不是总结事件。
  2.  **格式**：必须是短句用换行代替符号。
  3.  **长度**：总字数请严格控制在 **50字以内**，保持精炼。
  4.  **口吻**：以第一人称（“我”）来写，语言要富有文学性和感染力，严格符合你的角色设定。
  5.  **风格参考**：就像这样，“请幸福降临我手心。”“万物皆有裂痕\\n但那是光照进来的地方”
“人们传颂勇气\\n而我可不可以爱你哭泣的心。 ”`;

    const historyForAPI = processHistoryForAPI(chat.history);

    // 3. 发起 API 请求并处理结果
    try {
        const response = await fetch(`${appState.apiConfig.url.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${appState.apiConfig.key}` },
            body: JSON.stringify({
                model: appState.apiConfig.model,
                messages: [{ role: 'system', content: systemPrompt }, ...historyForAPI]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'AI 服务响应失败');
        }

        const data = await response.json();
        const diaryEntry = data.choices[0]?.message?.content.trim();

        if (diaryEntry) {
            diaryTextContainer.innerHTML = `<p>${diaryEntry.replace(/\n/g, '<br>')}</p>`;
        } else {
            throw new Error('AI 未能生成有效的日记内容。');
        }

    } catch (error) {
        console.error('生成日记时发生错误:', error);
        diaryTextContainer.innerHTML = `<p style="color: red;">抱歉，生成日记时发生了一点小问题...<br>(${error.message})</p>`;
    }
}

// ▼▼▼ 全新函数：将指定“我的面具”设为主要（默认）用户 ▼▼▼
const setAsPrimaryPersona = async () => {
    const index = appState.editingPresetIndex;

    // 安全检查：必须是“我的面具”，且不是新建的，也不是当前第一个
    if (appState.currentPersonaType !== 'my' || index < 1) {
        alert('此角色已经是主要形象，或无法设定。');
        return;
    }

    // 弹出确认框
    showCustomConfirm(
        '确认操作',
        `您确定要将 <b>"${appState.personas.my[index].name}"</b> 设为您的主要形象吗？<br><br>之后新建对话、发朋友圈等操作都将默认使用此形象。`,
        async () => {
            // 1. 从数组中“剪切”出当前编辑的角色
            const selectedPersona = appState.personas.my.splice(index, 1)[0];

            // 2. 将这个角色“粘贴”到数组的最前面
            appState.personas.my.unshift(selectedPersona);

            // 3. 将更新后的数组保存到数据库
            await dbStorage.set(KEYS.PERSONA_MY, appState.personas.my);

            // 4. 提示用户并返回列表
            alert(`“${selectedPersona.name}” 已被设为您的主要形象！`);
            showPersonaList('my'); // 返回“我的面具”列表页
        }
    );
};
// ▲▲▲ 新增函数结束 ▲▲▲

async function updatePersonaAndCascadeChanges(index, type, newData) {
    if (index < 0 || !appState.personas[type][index]) {
        console.error("无法更新：提供的人设索引无效。");
        return;
    }

    // 1. 获取旧数据，特别是旧名字，用于查找匹配项。
    const originalPersona = { ...appState.personas[type][index] };
    const originalName = originalPersona.name;

    // 2. 更新核心人设库 (appState)
    appState.personas[type][index] = { ...originalPersona, ...newData };
    console.log(`人设库已更新: "${originalName}" -> "${newData.name}"`);

    // 3. 同步更新【联系人】列表
    // (仅当修改的是 AI 人设时才需要)
    if (type === 'ai') {
        const contactToUpdate = appState.contacts.find(c => c.name === originalName);
        if (contactToUpdate) {
            contactToUpdate.name = newData.name;
            contactToUpdate.avatar = newData.avatar;
            contactToUpdate.content = newData.content;
            console.log(`联系人已同步: "${contactToUpdate.name}"`);
        }
    }

    // 4. 遍历并同步所有【聊天】
    for (const chatId in appState.chats) {
        const chat = appState.chats[chatId];
        let chatWasModified = false;

        if (chat.type === 'group') {
            // --- 处理群聊 ---
            if (type === 'ai') {
                const memberToUpdate = chat.personas.ai.find(m => m.name === originalName);
                if (memberToUpdate) {
                    memberToUpdate.name = newData.name;
                    memberToUpdate.avatar = newData.avatar;
                    memberToUpdate.content = newData.content;
                    chatWasModified = true;
                }
            }
        } else {
            // --- 处理单聊 ---
            const personaInChat = chat.personas[type];
            if (personaInChat && personaInChat.name === originalName) {
                // 更新这个聊天里的人设数据
                chat.personas[type] = { ...personaInChat, ...newData };
                
                // 如果聊天备注名和人设旧名一样，就一起更新备注名
                if (chat.name === originalName) {
                    chat.name = newData.name;
                }
                chatWasModified = true;
            }
        }
        
        if (chatWasModified) {
             console.log(`聊天 [${chat.name}] 已同步。`);
        }
    }

    // 5. 将所有发生变化的数据一次性保存到数据库
    await dbStorage.set(KEYS.PERSONA_AI, appState.personas.ai);
    await dbStorage.set(KEYS.PERSONA_MY, appState.personas.my);
    await dbStorage.set(KEYS.CONTACTS, appState.contacts);
    await dbStorage.set(KEYS.CHATS, appState.chats);

    console.log("所有数据已保存到数据库。");

    // 6. 刷新UI界面，让用户立即看到变化
    // 如果当前聊天被修改了，实时更新标题
    const activeChat = appState.chats[appState.activeChatId];
    if (activeChat && activeChat.name) {
        document.getElementById('chat-title').textContent = activeChat.name;
    }
    
    // 重新渲染列表
    renderChatList();
    renderContactsList();
}

// --- ▼▼▼ 請將這些新函數添加到 <script> 內 ▼▼▼ ---

// 進入多選模式
const enterMultiSelectMode = (initialMessage) => {
    appState.isMultiSelectMode = true;
    appState.selectedMessages.clear();
    appState.selectedMessages.add(initialMessage.timestamp);

    const chatScreen = document.getElementById('chat-screen');
    chatScreen.classList.add('multi-select-active');
    
    updateMultiSelectHeader();
    renderAllMessagesSelectionState();
};

// 退出多選模式
const exitMultiSelectMode = () => {
    appState.isMultiSelectMode = false;
    appState.selectedMessages.clear();

    const chatScreen = document.getElementById('chat-screen');
    chatScreen.classList.remove('multi-select-active');

    // 恢復正常的頂部標題欄
    const header = chatScreen.querySelector('.app-header');
    const multiSelectHeader = header.querySelector('.multiselect-header');
    if (multiSelectHeader) multiSelectHeader.remove();
    
    // 移除所有訊息的選中狀態
    document.querySelectorAll('.message-wrapper.selected').forEach(el => {
        el.classList.remove('selected');
    });
};

// 更新頂部操作欄的UI (取消和刪除按鈕)
const updateMultiSelectHeader = () => {
    const chat = appState.chats[appState.activeChatId];
    if (!chat) return;

    const header = document.getElementById('chat-screen').querySelector('.app-header');
    let multiSelectHeader = header.querySelector('.multiselect-header');

    // 如果操作欄不存在，就創建它
    if (!multiSelectHeader) {
        multiSelectHeader = document.createElement('div');
        multiSelectHeader.className = 'multiselect-header';
        header.appendChild(multiSelectHeader);
    }

    const count = appState.selectedMessages.size;
    multiSelectHeader.innerHTML = `
    <button class="cancel-btn">取消</button>
    <h2 id="chat-title" style="font-size: 17px; font-weight: 600; color: var(--header-text);">已選擇 ${count} 項</h2>
    <button class="delete-action-btn">
        删除
    </button>
`;

    // 綁定按鈕事件
    multiSelectHeader.querySelector('.cancel-btn').onclick = exitMultiSelectMode;
    multiSelectHeader.querySelector('.delete-action-btn').onclick = deleteSelectedMessages;
};

// 點擊訊息時，切換其選中狀態
const toggleMessageSelection = (message, wrapperElement) => {
    if (appState.selectedMessages.has(message.timestamp)) {
        appState.selectedMessages.delete(message.timestamp);
        wrapperElement.classList.remove('selected');
    } else {
        appState.selectedMessages.add(message.timestamp);
        wrapperElement.classList.add('selected');
    }
    updateMultiSelectHeader(); // 更新頂部計數
};

// 刪除所有被選中的訊息
const deleteSelectedMessages = () => {
    const count = appState.selectedMessages.size;
    if (count === 0) return;

    showCustomConfirm(
        '刪除訊息',
        `確定要刪除這 ${count} 條訊息嗎？`,
        async () => {
            const chat = appState.chats[appState.activeChatId];
            const idsToDelete = Array.from(appState.selectedMessages);

            // 1. 從 DOM 中移除元素並播放動畫
            const animations = idsToDelete.map(id => {
                const element = document.getElementById(`message-${id}`);
                return animateAndRemoveItem(element);
            });
            await Promise.all(animations);

            // 2. 從資料中過濾掉被刪除的訊息
            chat.history = chat.history.filter(msg => !idsToDelete.includes(msg.timestamp));
            
            // 3. 儲存並退出多選模式
            await dbStorage.set(KEYS.CHATS, appState.chats);
            exitMultiSelectMode();
        }
    );
};

// 為所有訊息加上選擇框和選中狀態
const renderAllMessagesSelectionState = () => {
    const messageWrappers = document.querySelectorAll('.message-wrapper');
    messageWrappers.forEach(wrapper => {
        // 加上選擇框 UI
        if (!wrapper.querySelector('.message-selection-indicator')) {
            const indicator = document.createElement('div');
            indicator.className = 'message-selection-indicator';
            wrapper.prepend(indicator);
        }

        // 更新選中狀態
        const timestamp = parseFloat(wrapper.id.replace('message-', ''));
        if (appState.selectedMessages.has(timestamp)) {
            wrapper.classList.add('selected');
        } else {
            wrapper.classList.remove('selected');
        }
    });
};

// --- ▲▲▲ 新增函數到此結束 ▲▲▲ ---

const setupEventListeners = () => {

setupBeautifyPreviewListeners();

viewModeBtn.addEventListener('click', toggleViewMode);

document.getElementById('export-theme-btn').onclick = exportTheme;
document.getElementById('import-theme-btn').onclick = () => {
    document.getElementById('theme-import-input').click();
};
document.getElementById('theme-import-input').addEventListener('change', handleThemeImport);

const setupTextureUpload = (buttonId, inputId, stateKey, applyFunction, statusId) => {
 
    document.getElementById(buttonId).onclick = () => {
        document.getElementById(inputId).click();
    };

    // 当用户选择了文件
    document.getElementById(inputId).addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Image = e.target.result;
            appState[stateKey] = base64Image; // 立即更新状态
            applyFunction(base64Image); // 立即应用预览
            document.getElementById(statusId).textContent = '已选择新贴图';
        };
        reader.readAsDataURL(file);
        event.target.value = ''; // 清空以便再次选择同个文件
    });
};

setupTextureUpload('change-default-bg-btn', 'default-bg-upload', 'defaultBackgroundTexture', applyDefaultBackgroundTexture, 'default-bg-status');
setupTextureUpload('change-top-bar-btn', 'top-bar-upload', 'topBarTexture', applyTopBarTexture, 'top-bar-status');
setupTextureUpload('change-bottom-bar-btn', 'bottom-bar-upload', 'bottomBarTexture', applyBottomBarTexture, 'bottom-bar-status');

// --- 全局贴图清除逻辑 ---
document.getElementById('clear-default-bg-btn').onclick = () => {
    appState.defaultBackgroundTexture = '';
    applyDefaultBackgroundTexture('');
    document.getElementById('default-bg-status').textContent = '已清除';
};
document.getElementById('clear-top-bar-btn').onclick = () => {
    appState.topBarTexture = '';
    applyTopBarTexture('');
    document.getElementById('top-bar-status').textContent = '已清除';
};
document.getElementById('clear-bottom-bar-btn').onclick = () => {
    appState.bottomBarTexture = '';
    applyBottomBarTexture('');
    document.getElementById('bottom-bar-status').textContent = '已清除';
};

// ▲▲▲ 新事件监听到此结束 ▲▲▲

// ... setupEventListeners 函数的其余部分 ...

// 为“设为主要形象”按钮绑定点击事件
document.getElementById('set-primary-persona-btn').onclick = setAsPrimaryPersona;

document.getElementById('modal-btn-end-music-session-from-player').onclick = () => {
    endListenTogether(true); // 调用结束函数
    closeMusicContactSelectionModal(); // 关闭当前弹窗
    showScreen('home-screen'); // 返回主屏幕
    alert('已退出听歌模式。');
};

document.getElementById('select-contact-for-music-btn').onclick = openMusicContactSelectionModal; // <--- 新增这一行
document.getElementById('cancel-music-contact-selection-btn').onclick = closeMusicContactSelectionModal; // <--- 新增这一行


    // 设置滑动条和数值显示
    const slider = document.getElementById('global-font-size-slider');
    const valueSpan = document.getElementById('font-size-value');
    const savedSize = appState.globalFontSize || 16;
    slider.value = savedSize;
    valueSpan.textContent = `${savedSize}px`;

    // 设置气泡大小按钮的选中状态
    const savedBubbleSize = appState.bubbleSize || 'medium';
    document.querySelectorAll('#bubble-size-selector .segmented-control-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.size === savedBubbleSize);
    });

    // ▼▼▼ 用这个新版本替换旧的 settings-hub-beautify-btn.onclick ▼▼▼
document.getElementById('settings-hub-beautify-btn').onclick = () => {
    // --- 已有代码，保持不变 ---
    document.getElementById('custom-font-url-input').value = appState.customFontUrl || '';
    document.getElementById('custom-css-input').value = appState.customCss || '';
    const slider = document.getElementById('global-font-size-slider');
    const valueSpan = document.getElementById('font-size-value');
    const savedSize = appState.globalFontSize || 16;
    slider.value = savedSize;
    valueSpan.textContent = `${savedSize}px`;
    const savedBubbleSize = appState.bubbleSize || 'medium';
    document.querySelectorAll('#bubble-size-selector .segmented-control-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.size === savedBubbleSize);
    });

    // --- 核心修改：更新三个贴图的状态显示 ---
    document.getElementById('default-bg-status').textContent = appState.defaultBackgroundTexture ? '已设置' : '未设置';
    document.getElementById('top-bar-status').textContent = appState.topBarTexture ? '已设置' : '未设置';
    document.getElementById('bottom-bar-status').textContent = appState.bottomBarTexture ? '已设置' : '未设置';

 // ▼▼▼ 在这里添加下面这行 ▼▼▼
    document.getElementById('custom-global-css-input').value = appState.customGlobalCss || '';
    // ▲▲▲ 添加结束 ▲▲▲

    showScreen('custom-beautification-screen');
};

// ▼▼▼ 使用这个【最终完整版】，替换旧的 save-beautification-btn.onclick 函数 ▼▼▼
document.getElementById('save-beautification-btn').onclick = async () => {
    // 1. 获取所有美化设置值
    const newFontUrl = document.getElementById('custom-font-url-input').value.trim();
    const newBubbleCss = document.getElementById('custom-css-input').value.trim();
    const newGlobalCss = document.getElementById('custom-global-css-input').value.trim(); // 新增
    const newFontSize = document.getElementById('global-font-size-slider').value;
    const selectedBubbleSize = document.querySelector('#bubble-size-selector .segmented-control-button.active').dataset.size;

    // 2. 更新 appState 中的所有美化设置
    appState.customFontUrl = newFontUrl;
    appState.customCss = newBubbleCss; // 气泡CSS
    appState.customGlobalCss = newGlobalCss; // 全局CSS
    appState.globalFontSize = parseFloat(newFontSize);
    appState.bubbleSize = selectedBubbleSize;

    // 3. 将所有美化设置完整保存到数据库
    try {
        await dbStorage.set(KEYS.CUSTOM_FONT_URL, appState.customFontUrl);
        await dbStorage.set(KEYS.CUSTOM_CSS, appState.customCss);
        await dbStorage.set(KEYS.CUSTOM_GLOBAL_CSS, appState.customGlobalCss); // 新增
        await dbStorage.set(KEYS.GLOBAL_FONT_SIZE, appState.globalFontSize);
        await dbStorage.set(KEYS.BUBBLE_SIZE, appState.bubbleSize);
        await dbStorage.set(KEYS.DEFAULT_BACKGROUND_TEXTURE, appState.defaultBackgroundTexture);
        await dbStorage.set(KEYS.TOP_BAR_TEXTURE, appState.topBarTexture);
        await dbStorage.set(KEYS.BOTTOM_BAR_TEXTURE, appState.bottomBarTexture);

        // 4. 实时应用所有样式
        applyCustomFont(appState.customFontUrl);
        applyCustomCss(appState.customCss); // 应用气泡CSS
        applyCustomGlobalCss(appState.customGlobalCss); // 应用全局CSS
        applyGlobalFontSize(appState.globalFontSize);
        applyBubbleSize(appState.bubbleSize);
        applyDefaultBackgroundTexture(appState.defaultBackgroundTexture);
        applyTopBarTexture(appState.topBarTexture);
        applyBottomBarTexture(appState.bottomBarTexture);

        alert('自定义美化设置已保存成功！');
        showScreen('settings-hub-screen');

    } catch (error) {
        console.error("保存美化设置时出错:", error);
        alert(`保存失败，可能是存储空间已满或发生错误。\n\n错误信息: ${error.message}`);
    }
};

document.querySelectorAll('#bubble-size-selector .segmented-control-button').forEach(button => {
    button.addEventListener('click', () => {
        // 移除所有按钮的选中状态
        document.querySelectorAll('#bubble-size-selector .segmented-control-button').forEach(btn => btn.classList.remove('active'));
        // 为当前点击的按钮添加选中状态
        button.classList.add('active');
        // 实时应用并预览效果
        applyBubbleSize(button.dataset.size);
    });
});

const fontSizeSlider = document.getElementById('global-font-size-slider');
const fontSizeValueSpan = document.getElementById('font-size-value');

fontSizeSlider.addEventListener('input', () => {
    const newSize = fontSizeSlider.value;
    fontSizeValueSpan.textContent = `${newSize}px`;
    // 实时应用字体大小变化
    applyGlobalFontSize(newSize);
});
// ▲▲▲ 新增代码结束 ▲▲▲

// “自定义美化”页 -> 返回按钮
document.getElementById('custom-beautification-back-btn').onclick = () => showScreen('settings-hub-screen');

// ▼▼▼ 为新增的“导入歌单”功能绑定事件 ▼▼▼
    document.getElementById('import-playlist-btn').onclick = openImportModal;
    document.getElementById('cancel-import-playlist').onclick = closeImportModal;
    document.getElementById('confirm-import-playlist').onclick = importNeteasePlaylist;

    // 当用户在输入框中输入内容时，动态启用“导入”按钮
    document.getElementById('playlist-url-input').addEventListener('input', (e) => {
        document.getElementById('confirm-import-playlist').disabled = e.target.value.trim() === '';
    });
// ▲▲▲ 事件绑定结束 ▲▲▲

    document.getElementById('player-mode-btn').onclick = togglePlaybackMode;
    document.getElementById('player-playlist-btn').onclick = openPlaylistSheet;
    document.getElementById('playlist-sheet-overlay').onclick = closePlaylistSheet;
    
    // 【重要】修改 audio 元素的 ended 事件，让它调用我们新的处理函数
    const playerForEvents = document.getElementById('global-audio-player');
    // 先移除旧的事件监听器，避免重复执行
    playerForEvents.removeEventListener('ended', nextTrack);
    // 再绑定新的、更智能的事件监听器
    playerForEvents.addEventListener('ended', handleTrackEnd);

    // --- 初始化播放模式按钮的UI ---
    updatePlaybackModeButtonUI();

    const donationBtn = document.getElementById('donation-btn');
    if (donationBtn) {
        donationBtn.onclick = () => {
            // 旧的逻辑是打开一个模态框，我们把它改成打开新页面
            showScreen('donation-page-screen'); 
        };
    }
    // 新增打赏页面的返回按钮事件
    const donationPageBackBtn = document.getElementById('donation-page-back-btn');
    if (donationPageBackBtn) {
        donationPageBackBtn.onclick = () => showScreen('settings-hub-screen');
    }

    // --- 【修改】免责声明按钮事件 ---
    const disclaimerBtn = document.getElementById('settings-hub-disclaimer-btn');
    if (disclaimerBtn) {
        disclaimerBtn.onclick = () => {
            // 旧的逻辑是 alert() 弹窗，我们把它改成打开新页面
            showScreen('disclaimer-screen');
        };
    }
    // 新增免责声明页面的返回按钮事件
    const disclaimerBackBtn = document.getElementById('disclaimer-back-btn');
    if (disclaimerBackBtn) {
        disclaimerBackBtn.onclick = () => showScreen('settings-hub-screen');
    }

    document.getElementById('cancel-outgoing-call-btn').onclick = () => {
        showScreen('chat-screen');
        appendSystemMessageToChat('呼叫已取消');
    };

// ... setupEventListeners 函数内部的其他代码 ...

    // 为 Dock 栏的音乐按钮添加点击事件
    document.getElementById('home-btn-music').onclick = openMusicSelectionModal;

    // ... setupEventListeners 函数内部的其他代码 ...

// --- 表情命名弹窗的事件 ---
document.getElementById('save-sticker-name-btn').onclick = async () => {
    const nameInput = document.getElementById('sticker-name-input');
    const stickerName = nameInput.value.trim();
    if (!stickerName) {
        alert('请为表情包输入内容！');
        return;
    }
    if (appState.pendingSticker) {
        const newSticker = { url: appState.pendingSticker, name: stickerName };

        // ▼▼▼ 核心修改：根据上下文决定添加到哪个数组 ▼▼▼
        if (appState.stickerContext === 'ai') {
            appState.aiStickers.push(newSticker);
            await dbStorage.set(KEYS.AI_STICKERS, appState.aiStickers);
            renderAiStickers(); // 刷新对方的表情面板
        } else {
            appState.stickers.push(newSticker);
            await dbStorage.set(KEYS.STICKERS, appState.stickers);
            renderStickers(); // 刷新我的表情面板
        }
        // ▲▲▲ 修改结束 ▲▲▲
    
        document.getElementById('sticker-name-modal').classList.remove('active');
        appState.pendingSticker = null;
    }
};

document.getElementById('cancel-sticker-name-btn').onclick = () => {
    document.getElementById('sticker-name-modal').classList.remove('active');
    appState.pendingSticker = null; // 取消操作，清空暂存的图片
};

 // 为表情包切换按钮绑定事件
document.getElementById('switch-to-my-stickers').onclick = () => switchStickerView('my');
document.getElementById('switch-to-ai-stickers').onclick = () => switchStickerView('ai');
    document.getElementById('save-edit-btn').onclick = saveMessageEdit;
    document.getElementById('cancel-edit-btn').onclick = cancelMessageEdit;
    document.getElementById('action-view-diary').onclick = writeAndShowAIDiary;
  
    document.getElementById('diary-modal').onclick = (event) => {
    // 只有当点击事件的目标是 #diary-modal 本身（即空白处）时，才触发关闭
    if (event.target === event.currentTarget) {
        const diaryModal = document.getElementById('diary-modal');
        if (diaryModal) {
            diaryModal.classList.remove('active');
            setTimeout(() => {
                diaryModal.style.display = 'none';
            }, 400); // 匹配 CSS 中的 0.4s 动画时长
        }
    }
};

    document.getElementById('trigger-chat-wallpaper-upload').onclick = () => {
        document.getElementById('chat-wallpaper-upload').click();
    };
    document.getElementById('chat-wallpaper-upload').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            appState.pendingImage = e.target.result; 
            const statusEl = document.getElementById('chat-wallpaper-status');
            if (statusEl) {
                statusEl.textContent = '已选择新背景，请储存';
            }
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    });


    const chatInputArea = document.querySelector('.chat-input-area');
    const actionsPanel = document.getElementById('chat-actions-panel');
    const stickerPanel = document.getElementById('sticker-panel');
    document.getElementById('toggle-actions-panel-btn').addEventListener('click', () => {
        const panelIsOpen = chatInputArea.classList.contains('panel-open');
        const actionsAreVisible = getComputedStyle(actionsPanel).display !== 'none';
        if (panelIsOpen && actionsAreVisible) {
            closePanel();
        } else {
            openPanel('actions');
        }
    });
    document.getElementById('toggle-sticker-panel-btn').addEventListener('click', () => {
        const panelIsOpen = chatInputArea.classList.contains('panel-open');
        const stickersAreVisible = getComputedStyle(stickerPanel).display !== 'none';
        if (panelIsOpen && stickersAreVisible) {
            closePanel();
        } else {
            openPanel('stickers');
        }
    });


document.getElementById('settings-hub-widget-btn').onclick = openWidgetSettings;

// “小组件设定”页 -> 返回按钮
document.getElementById('widget-settings-back-btn').onclick = () => showScreen('settings-hub-screen');

// “小组件设定”页 -> 三个“更换”按钮，分别触发对应的隐藏上传框
document.getElementById('change-widget-bg-btn').onclick = () => document.getElementById('widget-bg-upload-input').click();
document.getElementById('change-widget-footer-btn').onclick = () => document.getElementById('widget-footer-upload-input').click();
document.getElementById('change-widget-avatar-btn').onclick = () => document.getElementById('widget-avatar-upload-input').click();

// a. 处理背景图上传
setupFileUploadHelper('widget-bg-upload-input', null, async (src) => {
    appState.widgetImages.bg = src;
    document.getElementById('widget-preview-bg').style.backgroundImage = `url(${src})`; // 更新预览
    await dbStorage.set(KEYS.DECORATIVE_WIDGET_IMAGES, appState.widgetImages);
    applyWidgetImages(); // 实时更新主屏幕上的小组件
});

// --- 新增：为小组件设定页的“清除”和“保存”按钮绑定功能 ---

    // 绑定“清除全部”按钮的点击事件
    document.getElementById('clear-all-widget-btn').onclick = () => {
        // 使用自定义的确认弹窗，防止用户误触
        showCustomConfirm(
            '清除全部图片',
            '您确定要清除小组件的背景、页脚和头像图片吗？此操作将立即生效。',
            async () => {
                // 1. 清空内存中的图片数据
                appState.widgetImages = { bg: null, footer: null, avatar: null };

                // 2. 将清空后的状态保存到数据库
                await dbStorage.set(KEYS.DECORATIVE_WIDGET_IMAGES, appState.widgetImages);

                // 3. 更新当前设定页的预览UI，移除图片
                document.getElementById('widget-preview-bg').style.backgroundImage = 'none';
                document.getElementById('widget-preview-footer').style.backgroundImage = 'none';
                document.getElementById('widget-preview-avatar').style.backgroundImage = 'none';

                // 4. 更新主屏幕上的实际小组件，移除图片
                applyWidgetImages();
            }
        );
    };

// 为主动搭话频率按钮添加点击事件
document.querySelectorAll('#proactive-frequency-selector .segmented-control-button').forEach(button => {
    button.onclick = () => {
        // 先移除所有按钮的选中状态
        document.querySelectorAll('#proactive-frequency-selector .segmented-control-button').forEach(btn => btn.classList.remove('active'));
        // 再为当前点击的按钮添加选中状态
        button.classList.add('active');
    };
});

    document.getElementById('save-widget-settings-btn').onclick = () => {
        
        alert('小组件设定已保存！');
        showScreen('home-screen'); // 返回主屏幕
    };

// b. 处理页脚图上传
setupFileUploadHelper('widget-footer-upload-input', null, async (src) => {
    appState.widgetImages.footer = src;
    document.getElementById('widget-preview-footer').style.backgroundImage = `url(${src})`; // 更新预览
    await dbStorage.set(KEYS.DECORATIVE_WIDGET_IMAGES, appState.widgetImages);
    applyWidgetImages(); // 实时更新主屏幕上的小组件
});

// c. 处理头像上传
setupFileUploadHelper('widget-avatar-upload-input', null, async (src) => {
    appState.widgetImages.avatar = src;
    document.getElementById('widget-preview-avatar').style.backgroundImage = `url(${src})`; // 更新预览
    await dbStorage.set(KEYS.DECORATIVE_WIDGET_IMAGES, appState.widgetImages);
    applyWidgetImages(); // 实时更新主屏幕上的小组件
});

    // --- 输入框与动态按钮逻辑 ---
    const chatInput = document.getElementById('chat-input');
    const dynamicBtn = document.getElementById('dynamic-action-btn');
    const sendFunction = async () => {
        const userText = chatInput.value.trim();
        if (!userText) return; 
        const chat = appState.chats[appState.activeChatId];
        if (!chat) return;
        await checkAndInsertTimestamp();
        const timestamp = Date.now();
        const messageData = { role: 'user', content: userText, timestamp: timestamp };
        if (appState.replyingToMessage) {
            messageData.replyTo = { role: appState.replyingToMessage.role, author: appState.replyingToMessage.author, content: appState.replyingToMessage.content, timestamp: appState.replyingToMessage.timestamp };
        }
        appendMessage(messageData); 
        chat.history.push(messageData); 
        await dbStorage.set(KEYS.CHATS, appState.chats);
        manageProactiveTimer(appState.activeChatId);
        chatInput.value = '';
        chatInput.style.height = 'auto';
        cancelReplying();
        dynamicBtn.classList.remove('send-mode');
        dynamicBtn.classList.add('receive-mode');
        dynamicBtn.onclick = receiveMessageHandler;
        document.getElementById('toggle-actions-panel-btn').disabled = false;
    };
    dynamicBtn.onclick = receiveMessageHandler;
   // --- 用下面的逻辑替换旧的 addEventListener 逻辑 ---
    chatInput.addEventListener('input', () => {
        const toggleActionsBtn = document.getElementById('toggle-actions-panel-btn');
        if (chatInput.value.trim().length > 0) {
            if (!dynamicBtn.classList.contains('send-mode')) {
                dynamicBtn.innerHTML = SEND_ICON_SVG; // <-- 修改这里
                dynamicBtn.classList.remove('receive-mode');
                dynamicBtn.classList.add('send-mode');
                dynamicBtn.onclick = sendFunction;
            }
            toggleActionsBtn.disabled = true;
            if (chatInputArea.classList.contains('panel-open')) {
                closePanel();
            }
        } else {
            if (!dynamicBtn.classList.contains('receive-mode')) {
                dynamicBtn.innerHTML = RECEIVE_ICON_SVG; // <-- 修改这里
                dynamicBtn.classList.remove('send-mode');
                dynamicBtn.classList.add('receive-mode');
                dynamicBtn.onclick = receiveMessageHandler;
            }
            toggleActionsBtn.disabled = false;
        }
    });

    document.getElementById('settings-hub-icon-btn').onclick = () => {
    
        appState.tempCustomIcons = JSON.parse(JSON.stringify(appState.customIcons));
        // 2. 渲染设定页
        renderIconSettingsGrid();
        showScreen('icon-settings-screen');
    };

    // 点击“保存全部图示”按钮
document.getElementById('save-icon-changes-btn').onclick = async () => {
    // 1. 将临时状态的更改正式应用到主状态
    appState.customIcons = JSON.parse(JSON.stringify(appState.tempCustomIcons));
    // 2. 保存到数据库
    await dbStorage.set(KEYS.CUSTOM_ICONS, appState.customIcons);
    // 3. 更新主屏幕的图标
    renderHomeScreenIcons();
    alert('图标已保存！');
    
    // 4. 【新增】跳转回主屏幕
    showScreen('home-screen');
};

 
    const cancelIconChanges = () => {
        // 清空临时状态，下次进入时会重新从主状态加载
        appState.tempCustomIcons = {}; 
        showScreen('settings-hub-screen');
    };

document.getElementById('cancel-icon-changes-btn').onclick = () => {
 
    showCustomConfirm(
        '清除全部自定义图示',
        '您确定要清除所有自定义图示并恢复为默认吗？<br><b>此操作将立即保存并生效，无法撤销。</b>',
        async () => {
           
            appState.customIcons = {};
            appState.tempCustomIcons = {};

            await dbStorage.set(KEYS.CUSTOM_ICONS, appState.customIcons);

     
            renderHomeScreenIcons();

            // 4. 更新当前设定页的预览UI
            renderIconSettingsGrid();

            // 5. 提示用户操作成功
            alert('所有自定义图示已清除并恢复为默认。');
        }
    );
};

    document.getElementById('icon-settings-back-btn').onclick = cancelIconChanges;
    document.getElementById('icon-upload-input').addEventListener('change', handleIconUpload);

    document.getElementById('home-btn-prompt').onclick = () => { renderPromptList(); showScreen('prompt-list-screen'); };
    document.getElementById('modal-btn-post-my-moment').onclick = () => { document.getElementById('moments-action-modal').classList.remove('active'); document.getElementById('post-text-input').value = ''; document.getElementById('post-image-text-input').value = ''; document.getElementById('post-location-input').value = ''; showScreen('create-post-screen'); };
    document.getElementById('modal-btn-generate-ai-moment').onclick = () => { document.getElementById('moments-action-modal').classList.remove('active'); openChatSelectionForMomentModal(); };
    document.getElementById('modal-btn-cancel-moments-action').onclick = () => { document.getElementById('moments-action-modal').classList.remove('active'); };
    document.getElementById('modal-btn-add-contact').onclick = () => { document.getElementById('create-new-modal').classList.remove('active'); openPersonaSelectionModal('add_contact'); };

// ▼▼▼ 将您剪切的代码粘贴在这里 ▼▼▼
document.getElementById('modal-btn-new-chat').onclick = () => {
    document.getElementById('create-new-modal').classList.remove('active');
    showScreen('create-chat-screen');
};
document.getElementById('modal-btn-new-group').onclick = () => {
    document.getElementById('create-new-modal').classList.remove('active');
    openCreateGroupChatScreen(); 
};
document.getElementById('modal-btn-cancel-create').onclick = () => {
    document.getElementById('create-new-modal').classList.remove('active');
};
// ▲▲▲ 粘贴到此结束 ▲▲▲

    document.getElementById('select-prompt-btn').onclick = openPromptSelectionModal;
    document.getElementById('me-page-profile-item').onclick = () => showPersonaList('my');
    document.getElementById('offline-mode-toggle').onclick = toggleOfflineMode;
    document.getElementById('prompt-list-back-btn').onclick = () => showScreen('home-screen');
    document.getElementById('prompt-editor-back-btn').onclick = () => showScreen('prompt-list-screen');
    document.getElementById('add-prompt-btn').onclick = () => openPromptEditor(-1);
    document.getElementById('prompt-edit-btn').onclick = (e) => { appState.editMode.prompt = !appState.editMode.prompt; e.target.textContent = appState.editMode.prompt ? '完成' : '编辑'; renderPromptList(); };
document.getElementById('settings-hub-dark-mode-toggle').onclick = toggleDarkMode;
    document.getElementById('save-prompt-btn').onclick = async () => { const title = document.getElementById('prompt-title-input').value.trim(); const content = document.getElementById('prompt-content-input').value.trim(); if (!title || !content) { alert('标题和内容都不能为空！'); return; } const promptData = { id: `prompt_${Date.now()}`, title, content }; if (appState.editingPromptIndex === -1) { appState.prompts.push(promptData); } else { const originalId = appState.prompts[appState.editingPromptIndex].id; appState.prompts[appState.editingPromptIndex] = { ...promptData, id: originalId }; } await dbStorage.set(KEYS.PROMPTS, appState.prompts); renderPromptList(); showScreen('prompt-list-screen'); };
    document.body.addEventListener('click', () => { document.querySelectorAll('.interaction-popup.active').forEach(p => { p.classList.remove('active'); }); }, true);
    document.getElementById('custom-confirm-cancel-btn').onclick = hideCustomConfirm;
    document.getElementById('home-btn-main-hub').onclick = () => { switchTab('chat'); showScreen('main-hub-screen'); };
   
    document.getElementById('home-btn-ai-persona').onclick = () => showPersonaList('ai');
    document.getElementById('home-btn-my-persona').onclick = () => showPersonaList('my');
       document.getElementById('home-btn-settings').onclick = () => showScreen('settings-hub-screen');

// ▼▼▼ 在 setupEventListeners 函数内，加入这段最终代码 ▼▼▼

// “设定”页面 -> “汇出”按钮
document.getElementById('export-data-btn').onclick = exportDataSimple;

// “设定”页面 -> “汇入”按钮 (它会触发隐藏的档案选择框)
document.getElementById('import-data-btn').onclick = () => {
    document.getElementById('import-file-input').click();
};

// 当使用者选择了档案后，执行汇入操作
document.getElementById('import-file-input').addEventListener('change', handleImportSimple);

// ▲▲▲ 代码加到这里结束 ▲▲▲

    // 设置主页的返回按钮
    document.getElementById('settings-hub-back-btn').onclick = () => showScreen('home-screen');

    // 设置主页里的“API 设定”项目
    document.getElementById('settings-hub-api-btn').onclick = () => showScreen('api-settings-screen');

document.getElementById('settings-hub-wallpaper-btn').onclick = () => {
    // 在显示页面前，先获取预览图片的元素
    const previewImg = document.getElementById('home-wallpaper-preview');
    previewImg.src = appState.homeWallpaper || '';
    // 然后再显示设定页面
    showScreen('home-settings-screen');
};
    document.getElementById('main-hub-back-btn').onclick = () => showScreen('home-screen');
    // ▼▼▼ 修改這一行 ▼▼▼
document.getElementById('api-settings-back-btn').onclick = () => showScreen('settings-hub-screen');
    document.getElementById('chat-settings-back-btn').onclick = () => { const chat = appState.chats[appState.activeChatId]; if (chat && chat.isOfflineMode) { document.getElementById('phone-screen').classList.add('offline-active'); } showScreen('chat-screen'); };
    document.getElementById('home-settings-back-btn').onclick = () => showScreen('settings-hub-screen');
    document.getElementById('create-chat-back-btn').onclick = () => showScreen('main-hub-screen');
    document.getElementById('persona-editor-back-btn').onclick = () => showPersonaList(appState.currentPersonaType);
    document.getElementById('call-log-back-btn').onclick = () => showScreen('chat-screen');
    document.getElementById('cancel-chat-selection-btn').onclick = closeChatSelectionForMomentModal;
    document.getElementById('select-chat-for-moment-modal').onclick = (e) => { if (e.target === e.currentTarget) closeChatSelectionForMomentModal(); };
    document.getElementById('ai-persona-list-back-btn').onclick = () => { if(appState.editMode.ai_persona){ appState.editMode.ai_persona = false; document.getElementById('ai-persona-edit-btn').textContent = '编辑'; } showScreen('home-screen'); };
    document.getElementById('my-persona-list-back-btn').onclick = () => { if(appState.editMode.my_persona){ appState.editMode.my_persona = false; document.getElementById('my-persona-edit-btn').textContent = '编辑'; } showScreen('home-screen'); };
    document.getElementById('chat-back-btn').onclick = () => { if (appState.editMode.chat) { appState.editMode.chat = false; document.getElementById('main-hub-edit-btn').textContent = '编辑'; } document.getElementById('phone-screen').classList.remove('offline-active'); switchTab('chat'); showScreen('main-hub-screen'); };
    document.querySelectorAll('.tab-item').forEach(tab => tab.onclick = () => switchTab(tab.id.replace('tab-btn-', '')));
    document.getElementById('main-hub-edit-btn').onclick = (e) => { appState.editMode.chat = !appState.editMode.chat; e.target.textContent = appState.editMode.chat ? '完成' : '编辑'; renderChatList(); };
    ['ai', 'my'].forEach(type => { document.getElementById(`${type}-persona-edit-btn`).onclick = (e) => { appState.editMode[`${type}_persona`] = !appState.editMode[`${type}_persona`]; e.target.textContent = appState.editMode[`${type}_persona`] ? '完成' : '编辑'; renderPersonaList(type); }; });
    document.getElementById('chat-settings-btn').onclick = openChatSettings;
    document.getElementById('action-send-image').onclick = () => { document.getElementById('image-upload-input').click(); };
    document.getElementById('image-upload-input').addEventListener('change', async (event) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = async (e) => { const base64Image = e.target.result; const chat = appState.chats[appState.activeChatId]; if (!chat) return; await checkAndInsertTimestamp(); const imageTimestamp = Date.now(); const imageData = { type: 'just_image', url: base64Image }; appendMessage({ role: 'user', content: imageData, timestamp: imageTimestamp }); chat.history.push({ role: 'user', content: imageData, timestamp: imageTimestamp }); await dbStorage.set(KEYS.CHATS, appState.chats); }; reader.readAsDataURL(file); event.target.value = ''; });
    document.getElementById('action-send-image-text').onclick = openImageModal; document.getElementById('cancel-image-btn').onclick = closeImageModal; document.getElementById('send-image-btn').onclick = sendImageMessage; document.getElementById('action-send-location').onclick = openLocationModal; document.getElementById('action-send-voice').onclick = openVoiceModal;

document.getElementById('action-start-videocall').onclick = requestCallDecision;

// ▼▼▼ 将剪切的代码粘贴到这里 ▼▼▼
document.getElementById('action-listen-music').onclick = openMusicSelectionModal;

// 选歌弹窗的“取消”和“开始播放”按钮
document.getElementById('cancel-music-selection-btn').onclick = closeMusicSelectionModal;
document.getElementById('start-music-session-btn').onclick = () => {
    const song = document.getElementById('music-song-input').value.trim();
    const artist = document.getElementById('music-artist-input').value.trim();
    const url = document.getElementById('music-url-input').value.trim();
    if (!song || !artist || !url) {
        alert('请填写所有字段！');
        return;
    }
    closeMusicSelectionModal();
    startListenTogether(song, artist, url);
};

// 监听全局播放器，当歌曲自然播放结束时，自动结束会话
document.getElementById('global-audio-player').addEventListener('ended', () => {
    endListenTogether(true);
});
// ▲▲▲ 粘贴到此结束 ▲▲▲
document.getElementById('cancel-location-btn').onclick = closeLocationModal; document.getElementById('send-location-btn').onclick = sendLocationMessage; document.getElementById('cancel-voice-btn').onclick = closeVoiceModal; document.getElementById('send-voice-btn').onclick = sendVoiceMessage; document.getElementById('cancel-selection-btn').onclick = closePersonaSelectionModal; document.getElementById('persona-selection-modal').onclick = (e) => { if (e.target === e.currentTarget) closePersonaSelectionModal(); }; document.getElementById('videocall-hangup-btn').onclick = endVideoCall; document.getElementById('videocall-send-btn').onclick = sendVideoCallMessage; document.getElementById('videocall-input').onkeydown = (e) => { if (e.key === 'Enter') sendVideoCallMessage(); }; document.getElementById('sticker-screen-back-btn').onclick = () => showScreen('chat-screen'); document.getElementById('add-sticker-btn').onclick = () => { 

document.getElementById('sticker-upload-input').click(); }; 

document.getElementById('sticker-upload-input').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        // 1. 将选择的图片暂存起来
        appState.pendingSticker = e.target.result;
        // 2. 清空命名输入框并打开弹窗
        document.getElementById('sticker-name-input').value = '';
        document.getElementById('sticker-name-modal').classList.add('active');
    };
    reader.readAsDataURL(file);
    event.target.value = ''; // 清空，以便下次能选择同一个文件
});

document.getElementById('add-ai-persona-btn').onclick = () => openPersonaEditor('ai', -1); document.getElementById('add-my-persona-btn').onclick = () => openPersonaEditor('my', -1); document.getElementById('save-preset-btn').onclick = async () => { const name = document.getElementById('preset-name-input').value.trim(); if (!name) { alert('预设名称不能为空！'); return; } const content = document.getElementById('preset-content-input').value.trim(); const avatar = document.getElementById('preset-avatar-preview').src; const type = appState.currentPersonaType; const index = appState.editingPresetIndex; const newData = { name, content, avatar }; if (index > -1) { await updatePersonaAndCascadeChanges(index, type, newData); } else { appState.personas[type].push(newData); const key = type === 'ai' ? KEYS.PERSONA_AI : KEYS.PERSONA_MY; await dbStorage.set(key, appState.personas[type]); } showPersonaList(type); }; document.getElementById('create-chat-btn').onclick = async () => { const name = document.getElementById('new-chat-name-input').value.trim(); if (!name) return alert('請為對話取一個名稱！'); if (!appState.newChatTempPersonas.ai || !appState.newChatTempPersonas.my) return alert('請為雙方選擇角色設定！'); const newChatId = 'chat_' + Date.now(); appState.chats[newChatId] = { name, history: [], personas: { ...appState.newChatTempPersonas }, wallpaper: null, memoryRounds: 0, isOfflineMode: false }; await dbStorage.set(KEYS.CHATS, appState.chats); document.getElementById('new-chat-name-input').value = ''; ['ai', 'my'].forEach(type => { const el = document.getElementById(`new-chat-${type}-selection-text`); el.textContent = type === 'ai' ? '從 AI 人設庫選擇' : '從我的素材庫選擇'; el.classList.add('placeholder'); }); switchTab('chat'); openChat(newChatId); }; document.getElementById('select-ai-persona-btn').onclick = () => openPersonaSelectionModal('ai'); // 【核心修复】为发起群聊页面的“我的面具”选择按钮绑定正确的点击事件
document.getElementById('select-group-my-persona-btn').onclick = () => openPersonaSelectionModal('group_my'); document.getElementById('select-new-ai-persona-btn').onclick = () => openPersonaSelectionModal('new_ai'); document.getElementById('select-new-my-persona-btn').onclick = () => openPersonaSelectionModal('new_my'); document.getElementById('clear-home-wallpaper-btn').onclick = () => { document.getElementById('home-wallpaper-preview').src = ''; }; document.getElementById('save-home-settings-btn').onclick = async () => {
    const wallpaperSrc = document.getElementById('home-wallpaper-preview').src;
    let newWallpaper = null;

    if (wallpaperSrc.startsWith('data:image')) {
        newWallpaper = wallpaperSrc;
    }

    // 更新全局状态和数据库
    appState.homeWallpaper = newWallpaper;
    await dbStorage.set(KEYS.HOME_WALLPAPER, newWallpaper);

    document.getElementById('home-screen').style.backgroundImage = newWallpaper ? `url(${newWallpaper})` : 'none';
// ▼▼▼ 在这里添加下面这行代码 ▼▼▼
document.getElementById('home-screen').style.backgroundColor = newWallpaper ? 'transparent' : '';

    alert('主画面设定已储存！');
    showScreen('home-screen');
};
 document.getElementById('save-api-btn').onclick = async () => { appState.apiConfig = { url: document.getElementById('api-url-input').value.trim(), key: document.getElementById('api-key-input').value.trim(), model: document.getElementById('api-model-input').value.trim() }; await dbStorage.set(KEYS.API, appState.apiConfig); alert('全部 API 設定已儲存！'); }; document.getElementById('fetch-models-btn').onclick = async () => { const url = document.getElementById('api-url-input').value.trim(); const key = document.getElementById('api-key-input').value.trim(); const btn = document.getElementById('fetch-models-btn'); const originalText = btn.textContent; if (!url || !key) { alert('請先輸入 API URL 和 API Key！'); return; } btn.disabled = true; btn.textContent = '獲取中...'; try { const response = await fetch(`${url.replace(/\/$/, '')}/models`, { headers: { 'Authorization': `Bearer ${key}` } }); if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error?.message || `HTTP 錯誤: ${response.status}`); } const data = await response.json(); const modelSelect = document.getElementById('api-model-select'); modelSelect.innerHTML = '<option value="">--- 請選擇一個模型 ---</option>'; if (data.data && Array.isArray(data.data)) { const sortedModels = data.data.sort((a, b) => { const aId = a.id.toLowerCase(); const bId = b.id.toLowerCase(); if (aId.includes('gpt-4') && !bId.includes('gpt-4')) return -1; if (!aId.includes('gpt-4') && bId.includes('gpt-4')) return 1; if (aId.includes('gpt-3.5') && !bId.includes('gpt-3.5')) return -1; if (!aId.includes('gpt-3.5') && bId.includes('gpt-3.5')) return 1; return a.id.localeCompare(b.id); }); sortedModels.forEach(model => { const option = document.createElement('option'); option.value = model.id; option.textContent = model.id; modelSelect.appendChild(option); }); } modelSelect.style.display = 'block'; alert('模型列表已成功獲取！'); } catch (error) { alert(`獲取模型失敗：${error.message}`); } finally { btn.disabled = false; btn.textContent = originalText; } }; document.getElementById('api-model-select').onchange = (e) => { if (e.target.value) { document.getElementById('api-model-input').value = e.target.value; } }; document.getElementById('send-post-btn').onclick = async () => { const text = document.getElementById('post-text-input').value.trim(); const imagePromptsInput = document.getElementById('post-image-text-input').value.trim(); const image_prompts = imagePromptsInput ? imagePromptsInput.split(/[,，]/).map(p => p.trim()).filter(p => p) : []; if (!text && image_prompts.length === 0) return alert('文字和配图想法至少要有一个！'); const myPersonaName = appState.personas.my[0]?.name || '我'; const newPost = { author: myPersonaName, text, image_prompts, location: document.getElementById('post-location-input').value.trim(), timestamp: Date.now(), likes: [], comments: [] }; appState.momentsData.posts.unshift(newPost); await saveAndRenderMoments(); document.getElementById('post-text-input').value = ''; document.getElementById('post-image-text-input').value = ''; document.getElementById('post-location-input').value = ''; await notifyAisOfNewMoment(newPost); showScreen('main-hub-screen'); }; document.getElementById('cancel-post-btn').onclick = () => showScreen('main-hub-screen'); document.getElementById('moments-cover-img').onclick = () => document.getElementById('moments-cover-upload').click(); document.getElementById('moments-user-avatar').onclick = () => document.getElementById('moments-avatar-upload').click(); document.getElementById('moments-feed').addEventListener('click', (e) => { const imageItem = e.target.closest('.post-image-item'); if (imageItem && imageItem.querySelector('.image-text-cover')) { const cover = imageItem.querySelector('.image-text-cover'); const details = imageItem.querySelector('.image-text-details'); if (cover && details) { const isCoverVisible = cover.style.display !== 'none'; cover.style.display = isCoverVisible ? 'none' : 'flex'; details.style.display = isCoverVisible ? 'block' : 'none'; } return; } const toggleBtn = e.target.closest('.interaction-toggle-btn'); if (toggleBtn) { e.stopPropagation(); const postIndex = toggleBtn.dataset.postIndex; const popup = document.getElementById(`popup-${postIndex}`); document.querySelectorAll('.interaction-popup.active').forEach(p => { if (p.id !== popup.id) p.classList.remove('active'); }); if (popup) popup.classList.toggle('active'); return; } const commentBtn = e.target.closest('.popup-action.comment-btn'); if (commentBtn) { e.stopPropagation(); const postIndex = commentBtn.dataset.postIndex; const postElement = commentBtn.closest('.moment-post'); if (postElement) { const interactionArea = postElement.querySelector('.moment-interaction-area'); const commentsSection = postElement.querySelector('.moment-comments-section'); if (interactionArea) { interactionArea.style.display = 'block'; } if (commentsSection) { commentsSection.style.display = 'block'; } const inputArea = postElement.querySelector(`#comment-input-area-${postIndex}`); const inputField = postElement.querySelector(`#comment-input-${postIndex}`); if (inputArea) { inputArea.classList.add('active'); } if (inputField) { inputField.focus(); } } const popup = commentBtn.closest('.interaction-popup'); if (popup) popup.classList.remove('active'); return; } const likeBtn = e.target.closest('.popup-action.like-btn'); if(likeBtn) { interactWithMoment(likeBtn.dataset.author, parseInt(likeBtn.dataset.postIndex), 'like'); const popup = likeBtn.closest('.interaction-popup'); if (popup) popup.classList.remove('active'); return; } const commentSendBtn = e.target.closest('.comment-send-btn'); if(commentSendBtn) { const postIndex = parseInt(commentSendBtn.dataset.postIndex); const input = document.getElementById(`comment-input-${postIndex}`); postMomentComment(postIndex, input.value); input.value = ''; const inputArea = commentSendBtn.closest('.comment-input-area'); if (inputArea) inputArea.classList.remove('active'); return; } }); setupFileUploadHelper('chat-wallpaper-upload', 'chat-wallpaper-preview'); setupFileUploadHelper('home-wallpaper-upload', 'home-wallpaper-preview'); setupFileUploadHelper('moments-cover-upload', 'moments-cover-img', (src) => { appState.momentsData.cover = src; saveAndRenderMoments(); }); setupFileUploadHelper('moments-avatar-upload', 'moments-user-avatar', (src) => { appState.momentsData.avatar = src; saveAndRenderMoments(); }); setupFileUploadHelper('preset-avatar-upload', 'preset-avatar-preview'); const openTransferModal = () => { document.getElementById('transfer-amount-input').value = ''; document.getElementById('transfer-remark-input').value = ''; document.getElementById('transfer-modal').classList.add('active'); }; const closeTransferModal = () => { document.getElementById('transfer-modal').classList.remove('active'); }; const sendTransferMessage = async () => { const amountInput = document.getElementById('transfer-amount-input'); const remarkInput = document.getElementById('transfer-remark-input'); const amount = parseFloat(amountInput.value); const remark = remarkInput.value.trim(); if (isNaN(amount) || amount <= 0) { alert('请输入有效的转账金额！'); return; } const chat = appState.chats[appState.activeChatId]; if (!chat) return; await checkAndInsertTimestamp(); const timestamp = Date.now(); const messageData = { type: 'transfer', amount: amount, remark: remark }; appendMessage({ role: 'user', content: messageData, timestamp: timestamp }); chat.history.push({ role: 'user', content: messageData, timestamp: timestamp });
    await dbStorage.set(KEYS.CHATS, appState.chats);
    closeTransferModal();
    const randomDelay = Math.random() * 2000 + 2000; // 2-4秒的随机延迟
    setTimeout(() => {
        simulateAIReceivingTransfer(timestamp);
    }, randomDelay);
};
 document.getElementById('action-send-transfer').onclick = openTransferModal; document.getElementById('cancel-transfer-btn').onclick = closeTransferModal; document.getElementById('send-transfer-btn').onclick = sendTransferMessage; document.getElementById('cancel-reply-btn').onclick = cancelReplying; document.body.addEventListener('click', hideContextMenu, true); document.getElementById('time-awareness-toggle').onclick = (e) => { e.currentTarget.classList.toggle('active'); }; document.getElementById('save-chat-settings-btn').onclick = async () => { const chat = appState.chats[appState.activeChatId]; if (!chat) return; chat.name = document.getElementById('chat-name-input').value.trim(); if (appState.pendingImage) { chat.wallpaper = appState.pendingImage; appState.pendingImage = null; } chat.memoryRounds = parseInt(document.getElementById('chat-memory-rounds-input').value) || 0; chat.timeAwareness = document.getElementById('time-awareness-toggle').classList.contains('active'); chat.proactiveMessaging = document.getElementById('proactive-messaging-toggle').classList.contains('active'); const activeFrequencyButton = document.querySelector('#proactive-frequency-selector .segmented-control-button.active');
chat.proactiveInterval = activeFrequencyButton ? parseInt(activeFrequencyButton.dataset.value, 10) : 10; await dbStorage.set(KEYS.CHATS, appState.chats); manageProactiveTimer(appState.activeChatId); alert('对话设定已储存！'); openChat(appState.activeChatId); }; document.getElementById('proactive-messaging-toggle').onclick = (e) => { e.currentTarget.classList.toggle('active'); }; document.getElementById('start-chat-from-editor-btn').onclick = () => { const type = appState.currentPersonaType; const index = appState.editingPresetIndex; if (index === -1) { alert('请先储存此预设，然后才能开始聊天。'); return; } if (type !== 'ai') { alert('只能与“AI人设库”中的角色开始聊天。'); return; } const persona = appState.personas[type][index]; if (persona) { startChatFromContacts(persona); } else { alert('错误：无法获取当前编辑的角色资料。'); } };

document.getElementById('public-account-back-btn').onclick = () => showScreen('main-hub-screen');

    // 彻底修改主页音乐按钮的点击行为
    document.getElementById('home-btn-music').onclick = openMusicPlayer;

    // 移除旧的、聊天界面内的音乐相关功能，因为它们已被新界面取代
    document.getElementById('action-listen-music').style.display = 'none'; // 直接隐藏按钮
    document.getElementById('music-player-bar').remove(); // 移除旧的播放条

    // 为新播放器界面的控件绑定事件
    document.getElementById('music-player-back-btn').onclick = () => showScreen('home-screen');
    document.getElementById('player-play-pause-btn').onclick = playPauseTrack;
    document.getElementById('player-next-btn').onclick = nextTrack;
    document.getElementById('player-prev-btn').onclick = prevTrack;

    // 为全局播放器绑定事件
    const player = document.getElementById('global-audio-player');
    player.addEventListener('timeupdate', updateProgress);
    player.addEventListener('play', renderMusicPlayerUI);
    player.addEventListener('pause', renderMusicPlayerUI);

    // 为进度条绑定拖动事件
    document.getElementById('player-progress-bar').addEventListener('input', seekProgress);

}; // <--- 这是 setupEventListeners 函数的正确结尾

const updateRealTimeClock = () => {
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const statusBarClock = document.getElementById('status-bar-time');
    if(statusBarClock) {
        statusBarClock.textContent = timeString;
    }
};

const renderHomeScreenIcons = () => {
    // 这里的默认值仅用于其他图标，小组件的默认值由HTML决定
    const iconsMap = {
        'icon-widget': { default: '🦋' }, 
        'icon-contacts': { default: '💬' },
        'icon-me': { default: '🩹' },
        'icon-settings': { default: '⚙️' },
        'icon-prompt': { default: '💭' },
        'icon-dock-1': { default: '🤍' },
        'icon-dock-2': { default: '🩶' },
        'icon-dock-3': { default: '🖤' },
    };

    for (const iconId in iconsMap) {
        const customSrc = appState.customIcons[iconId];

        // 核心修正：对小组件进行特殊处理
        if (iconId === 'icon-widget') {
            const widgetImageElement = document.getElementById('widget-main-image');
            // 只在有自定义图标时才修改src，否则保持HTML中的默认图片不变
            if (widgetImageElement && customSrc) {
                widgetImageElement.src = customSrc;
            }
        } else {
            // 其他图标保持原有逻辑
            const iconElement = document.getElementById(iconId);
            if (iconElement) {
                if (customSrc) {
                    iconElement.style.backgroundImage = `url(${customSrc})`;
                    iconElement.style.backgroundSize = 'cover';
                    iconElement.style.backgroundPosition = 'center';
                    iconElement.innerHTML = '';
                } else {
                    iconElement.style.backgroundImage = 'none';
                    iconElement.innerHTML = iconsMap[iconId].default;
                }
            }
        }
    }
};

const openWidgetSettings = () => {
    const { bg, footer, avatar } = appState.widgetImages;
    // 更新三个预览部分的背景图
    document.getElementById('widget-preview-bg').style.backgroundImage = bg ? `url(${bg})` : 'none';
    document.getElementById('widget-preview-footer').style.backgroundImage = footer ? `url(${footer})` : 'none';
    document.getElementById('widget-preview-avatar').style.backgroundImage = avatar ? `url(${avatar})` : 'none';
    showScreen('widget-settings-screen');
};

/**
 * 计算并设置真实的视口高度，以解决移动端浏览器UI遮挡问题
 */
const setRealViewportHeight = () => {
    const realViewportHeight = window.innerHeight;
    document.documentElement.style.setProperty('--real-vh', `${realViewportHeight}px`);
    console.log(`Real viewport height set to: ${realViewportHeight}px`); // 添加日志方便调试
};

// 【关键修改】在脚本加载时，立刻执行一次，确保初始高度正确
setRealViewportHeight();

// 在页面加载完成和窗口大小变化时再次执行，以应对各种动态变化
window.addEventListener('resize', setRealViewportHeight);
// (保留 load 事件作为双重保险)
window.addEventListener('load', setRealViewportHeight);

// ▼▼▼ 粘贴这一整块新的 JS 函数 ▼▼▼

const openMusicSelectionModal = () => {
    document.getElementById('music-selection-modal').classList.add('active');
};

const closeMusicSelectionModal = () => {
    document.getElementById('music-selection-modal').classList.remove('active');
};

const startListenTogether = async (song, artist, url) => {
    const chat = appState.activeChatId ? appState.chats[appState.activeChatId] : null; 
   

    // 结束上一个会话（以防万一）
    if (appState.activeMusicSession) {
        endListenTogether(false); // 传入 false 表示不发送结束语
    }

    const player = document.getElementById('global-audio-player');
    player.src = url;

    try {
        await player.play();

        // 更新状态
        appState.activeMusicSession = { song, artist, url };

        // 更新播放条UI
        const playerBar = document.getElementById('music-player-bar');
        playerBar.innerHTML = `
            <div class="album-art"></div>
            <div class="song-info">
                <div class="song-title">${song}</div>
                <div class="song-artist">${artist}</div>
            </div>
            <button id="stop-music-btn" class="stop-music-btn">&times;</button>
            <div class="progress-bar"></div>
        `;
        
        // ▼▼▼ 核心修改部分 ▼▼▼
        // 只有当我们在一个聊天界面时，才把播放条放进去
        if (chat) {
            const chatScreen = document.getElementById('chat-screen');
            const header = chatScreen.querySelector('.app-header');
            // 将播放条插入到 header 之后
            header.insertAdjacentElement('afterend', playerBar);
        }
        // ▲▲▲ 修改结束 ▲▲▲

        playerBar.style.display = 'flex';
        document.getElementById('stop-music-btn').onclick = () => endListenTogether(true);

        // ▼▼▼ 核心修改部分 ▼▼▼
        // 只有在聊天上下文中，才执行发消息、存历史、触发AI回应等操作
        if (chat) {
            const systemMsg = `[你正与“${chat.personas.ai.name}”一起收听《${song}》]`;
            await appendSystemMessageToChat(systemMsg);

            const hiddenPrompt = `[系统事件：用户开始播放歌曲《${song}》 - ${artist}。请你根据这首歌的氛围和你的角色设定，对此发表评论或联想。]`;
            chat.history.push({ role: 'system', content: hiddenPrompt, timestamp: Date.now(), hidden: true });
            await dbStorage.set(KEYS.CHATS, appState.chats);

            // 触发AI回应
            receiveMessageHandler();
        }
        // ▲▲▲ 修改结束 ▲▲▲

    } catch (error) {
        console.error("音频播放失败:", error);
        alert(`无法播放歌曲。\n原因：${error.message}\n\n提示：某些浏览器限制了自动播放，或者链接无效。`);
    }
};

const endListenTogether = async (shouldSendMessage = true) => {
    if (!appState.activeMusicSession) return;

    const player = document.getElementById('global-audio-player');
    player.pause();
    player.src = '';

    if (shouldSendMessage) {
        const chat = appState.chats[appState.activeChatId];
        if (chat) {
            let endMsg = `[收听结束]`;
            if (appState.musicSessionPartner) {
                endMsg = `[与“${appState.musicSessionPartner.name}”一起收听结束]`;
            }
            await appendSystemMessageToChat(endMsg);
        }
    }

    document.getElementById('music-player-bar').style.display = 'none';
    appState.activeMusicSession = null;

    // ▼▼▼ 在这里添加重置伙伴状态并隐藏头像的代码 ▼▼▼
    appState.musicSessionPartner = null;
    renderMusicSessionAvatars();
    // ▲▲▲ 新增代码结束 ▲▲▲
};

// ▼▼▼ 使用这个新版本替换之前的 open/close 函数 ▼▼▼
const openBeautifyPreview = () => {
    // Before showing, apply the latest styles
    updateLivePreview(); 
    const modal = document.getElementById('beautify-preview-modal');
    if (modal) {
        // 通过添加 'visible' class来触发CSS中的 opacity 动画
        modal.classList.add('visible'); 
    }
};

const closeBeautifyPreview = () => {
    const modal = document.getElementById('beautify-preview-modal');
    if (modal) {
        // 通过移除 'visible' class来隐藏
        modal.classList.remove('visible'); 
    }
};
// ▲▲▲ 替换到此结束 ▲▲▲

const playPauseTrack = () => {
    const player = document.getElementById('global-audio-player');
    if (!player.src || player.src === '') return; // 防止在没有歌曲时点击出错

    if (player.paused) {
        player.play();
    } else {
        player.pause();
    }
};
// ▲▲▲ 添加结束 ▲▲▲

const openMusicPlayer = () => {
    renderMusicSessionAvatars(); // <--- 在函数开头新增这一行
    renderMusicPlayerUI();
    showScreen('music-player-screen');
};

// ▼▼▼ 使用这个新版本替换旧的 renderMusicPlayerUI 函数 ▼▼▼
const renderMusicPlayerUI = () => {
    const player = document.getElementById('global-audio-player');
    const art = document.getElementById('player-album-art');
    const title = document.getElementById('player-song-title');
    const artist = document.getElementById('player-song-artist');
    const playPauseBtn = document.getElementById('player-play-pause-btn');
    const placeholderArt = 'https://i.postimg.cc/d1sY31J7/music-placeholder.png';

    // --- 新增：获取唱片元素 ---
    const vinylDisc = document.getElementById('vinyl-disc');

    const track = appState.playlist[appState.currentTrackIndex];

    if (track) {
        art.src = track.art || placeholderArt;
        title.textContent = track.title;
        artist.textContent = track.artist;
        // --- 新增：同时更新唱片贴纸的图片 ---
        document.getElementById('vinyl-label-img').src = track.art || placeholderArt;
    } else {
        art.src = placeholderArt;
        title.textContent = '未在播放';
        artist.textContent = '请添加歌曲';
        // --- 新增：同时更新唱片贴纸的图片 ---
        document.getElementById('vinyl-label-img').src = placeholderArt;
    }

    if (player.paused) {
        playPauseBtn.classList.remove('fa-pause-circle');
        playPauseBtn.classList.add('fa-play-circle');
        // --- 新增：暂停时移除 playing 类 ---
        if (vinylDisc) vinylDisc.classList.remove('playing'); 
    } else {
        playPauseBtn.classList.remove('fa-play-circle');
        playPauseBtn.classList.add('fa-pause-circle');
        // --- 新增：播放时添加 playing 类 ---
        if (vinylDisc) vinylDisc.classList.add('playing');
    }
};
// ▲▲▲ 替换结束 ▲▲▲

// ▼▼▼ 2. 新增：网易云歌单导入功能的所有函数 ▼▼▼

// 打开导入弹窗
const openImportModal = () => {
    const overlay = document.getElementById('import-modal-overlay');
    const input = document.getElementById('playlist-url-input');
    const confirmBtn = document.getElementById('confirm-import-playlist');
    
    input.value = ''; // 清空输入框
    confirmBtn.disabled = true; // 禁用确认按钮
    confirmBtn.innerHTML = '导入'; // 重置按钮文字
    
    overlay.classList.add('visible');
};

// 关闭导入弹窗
const closeImportModal = () => {
    document.getElementById('import-modal-overlay').classList.remove('visible');
};

// ▼▼▼ 使用这个【能识别VIP歌曲的增强版】替换旧的 importNeteasePlaylist 函数 ▼▼▼
const importNeteasePlaylist = async () => {
    const inputEl = document.getElementById('playlist-url-input');
    const confirmBtn = document.getElementById('confirm-import-playlist');
    const url = inputEl.value.trim();
    if (!url) return;

    // 从任何格式的链接或纯数字中提取出歌曲ID
    const match = url.match(/\d+/);
    const songId = match ? match[0] : null;

    if (!songId) {
        alert('无法从输入内容中解析出歌曲ID。');
        return;
    }

    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 识别中...';

    let songData;
    let lyricData;

    try {
        // --- 依次尝试所有备用API来获取歌曲详情 ---
        for (const endpoint of apiEndpoints) {
            try {
                const response = await fetch(`${endpoint}/song/detail?ids=${songId}`);
                if (!response.ok) continue;
                const data = await response.json();
                if (data.songs && data.songs.length > 0) {
                    songData = data.songs[0];
                    break;
                }
            } catch (e) { 
                console.warn(`API ${endpoint} 获取详情失败，尝试下一个...`, e);
            }
        }

        if (!songData) throw new Error('所有备用API都无法获取到这首歌曲的信息。');

        // --- 依次尝试所有备用API来获取歌词 ---
        for (const endpoint of apiEndpoints) {
            try {
                const response = await fetch(`${endpoint}/lyric?id=${songId}`);
                if (!response.ok) continue;
                const data = await response.json();
                if (data && data.lrc && data.lrc.lyric) {
                    lyricData = data.lrc.lyric;
                    break;
                }
            } catch (e) {
                console.warn(`API ${endpoint} 获取歌词失败，尝试下一个...`, e);
            }
        }
        
        // --- 核心修改：判断是否为VIP歌曲 ---
        // fee=1 是VIP歌曲, fee=4 是付费专辑歌曲
        const isVipSong = songData.fee === 1 || songData.fee === 4;

        // --- 组装歌曲信息 ---
        const newTrack = {
            title: songData.name,
            artist: songData.ar.map(artist => artist.name).join(' / '),
            art: songData.al.picUrl ? `${songData.al.picUrl}?param=400y400` : null,
            // 如果是VIP歌曲，URL设为null；否则，生成播放链接
            url: isVipSong ? null : `https://music.163.com/song/media/outer/url?id=${songId}.mp3`,
            lyrics: lyricData || "[00:00.00]暂无歌词"
        };

        appState.playlist.push(newTrack);
        await dbStorage.set(KEYS.PLAYLIST, appState.playlist);

        // --- 核心修改：根据是否为VIP歌曲，显示不同的提示信息 ---
        if (isVipSong) {
            alert(`歌曲《${songData.name}》的信息已导入，但因其为VIP歌曲，无法获取播放链接。\n\n您可以在播放列表中手动编辑它，并填入您自己的有效播放地址。`);
        } else {
            alert(`成功导入歌曲《${songData.name}》！`);
        }

        // --- 更新UI界面 ---
        if (appState.currentTrackIndex === -1 && !isVipSong) {
            // 只有在导入的是第一首非VIP歌曲时才自动播放
            loadTrack(appState.playlist.length - 1);
        }
        renderPlaylist();
        closeImportModal();

    } catch (error) {
        alert(`导入失败: ${error.message}`);
    } finally {
        // 恢复按钮状态
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '导入';
    }
};

// 解析 LRC 格式歌词的函数
const parseLRC = (lrc_s) => {
    if (!lrc_s) return [];
    const lines = lrc_s.split('\n');
    const result = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

    for (const line of lines) {
        const match = line.match(timeRegex);
        if (match) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const milliseconds = parseInt(match[3].padEnd(3, '0'), 10); // 兼容xx和xxx格式
            const time = minutes * 60 + seconds + milliseconds / 1000;
            const text = line.replace(timeRegex, '').trim();
            if (text) {
                result.push({ time, text });
            }
        }
    }
    return result;
};

// 在 UI 上显示歌词
const displayLyrics = (track) => {
    const lyricsContent = document.getElementById('player-lyrics-content');
    lyricsContent.innerHTML = ''; // 清空旧歌词

    if (!track || !track.lyrics) {
        lyricsContent.innerHTML = '<p class="lyric-line active">暂无歌词信息</p>';
        return;
    }
    
    // 解析歌词并暂存到全局，方便后续高亮
    appState.currentLyrics = parseLRC(track.lyrics);

    if (appState.currentLyrics.length === 0) {
        lyricsContent.innerHTML = '<p class="lyric-line active">歌词格式无法解析</p>';
        return;
    }

    // 将每一句歌词创建为一个 P 标签
    appState.currentLyrics.forEach((line, index) => {
        const p = document.createElement('p');
        p.className = 'lyric-line';
        p.textContent = line.text;
        p.dataset.index = index; // 标记行号
        lyricsContent.appendChild(p);
    });
};

// 请检查您的 updateLyricsUI 函数是否如下所示
const updateLyricsUI = (currentTime) => {
    if (!appState.currentLyrics || appState.currentLyrics.length === 0) return;

    let currentIndex = -1;
    // 找到当前时间应该高亮的歌词行
    for (let i = appState.currentLyrics.length - 1; i >= 0; i--) {
        if (currentTime >= appState.currentLyrics[i].time) {
            currentIndex = i;
            break;
        }
    }

    // 如果找到了当前行，并且它不是已经高亮的那一行
    if (currentIndex !== -1 && currentIndex !== appState.lastLyricIndex) {
        const lyricsContent = document.getElementById('player-lyrics-content');
        
        // 移除旧的高亮
        const oldActive = lyricsContent.querySelector('.lyric-line.active');
        if (oldActive) oldActive.classList.remove('active');

        // 添加新的高亮
        const newActive = lyricsContent.querySelector(`.lyric-line[data-index="${currentIndex}"]`);
        if (newActive) {
            newActive.classList.add('active');
            
            // 【核心】计算滚动位置，让高亮行尽量居中
            const containerRect = lyricsContent.parentElement.getBoundingClientRect();
            const lineRect = newActive.getBoundingClientRect();
            
            const scrollTop = lyricsContent.scrollTop + (lineRect.top - containerRect.top) - (containerRect.height / 2) + (lineRect.height / 2);
            
            // --- 这一行就是自动滚动的关键代码 ---
            lyricsContent.scrollTo({ top: scrollTop, behavior: 'smooth' });
        }
        
        appState.lastLyricIndex = currentIndex; // 记录当前行，防止重复操作
    }
};

// ▼▼▼ 使用这个唯一的、修正后的版本 ▼▼▼
const openMusicContactSelectionModal = () => {
    const modalList = document.getElementById('modal-music-contact-list');
    modalList.innerHTML = '';

    const singleAiChats = Object.values(appState.chats).filter(chat => chat.type !== 'group');

    if (singleAiChats.length === 0) {
        modalList.innerHTML = `<p style="text-align:center; color:#8a8a8a; padding: 20px;">没有可选择的联系人。</p>`;
    } else {
        singleAiChats.forEach(chat => {
            const item = document.createElement('div');
            item.className = 'list-item-content';
            item.style.cursor = 'pointer';
            item.style.padding = '8px 15px';

            const aiPersona = chat.personas.ai;
            item.innerHTML = `
                <img src="${aiPersona.avatar || DEFAULT_AVATAR}" class="list-item-avatar" style="width: 40px; height: 40px;">
                <span class="list-item-name">${aiPersona.name}</span>
            `;

            item.onclick = () => handleMusicContactSelect(aiPersona);
            modalList.appendChild(item);
        });
    }

    // 注意：这里不再有根据 appState.activeMusicSession 判断显示/隐藏的逻辑了
    // 按钮的显示将完全由您在上一步修改的 HTML 决定
    
    document.getElementById('select-contact-for-music-modal').classList.add('active');
};

/**
 * 关闭联系人选择弹窗
 */
const closeMusicContactSelectionModal = () => {
    document.getElementById('select-contact-for-music-modal').classList.remove('active');
};

/**
 * 处理联系人选择后的逻辑
 * @param {object} contactPersona - 被选中的联系人角色对象
 */
const handleMusicContactSelect = (contactPersona) => {
    appState.musicSessionPartner = contactPersona;
    console.log(`已选择与 ${contactPersona.name} 一起听歌。`);

    // 更新UI显示双人头像
    renderMusicSessionAvatars();

    // 关闭弹窗
    closeMusicContactSelectionModal();
};

/**
 * 渲染或隐藏双人头像的UI
 */
const renderMusicSessionAvatars = () => {
    const avatarsContainer = document.getElementById('music-session-avatars');
    const myAvatarImg = document.getElementById('music-my-avatar');
    const partnerAvatarImg = document.getElementById('music-partner-avatar');

    if (appState.musicSessionPartner && appState.personas.my[0]) {
        myAvatarImg.src = appState.personas.my[0].avatar || DEFAULT_AVATAR;
        partnerAvatarImg.src = appState.musicSessionPartner.avatar || DEFAULT_AVATAR;
        avatarsContainer.style.display = 'flex'; // 显示容器
    } else {
        avatarsContainer.style.display = 'none'; // 隐藏容器
    }
};

// ▲▲▲ 新增函数到此结束 ▲▲▲

const loadTrack = (index) => {
    // 重置上一首歌的歌词高亮索引
    appState.lastLyricIndex = -1;
    
    if (index < 0 || index >= appState.playlist.length) {
        const player = document.getElementById('global-audio-player');
        player.pause();
        player.src = '';
        appState.currentTrackIndex = -1;
        renderMusicPlayerUI();
        renderPlaylist();
        displayLyrics(null); // 【新增】清空歌词区域
        return;
    }

    const player = document.getElementById('global-audio-player');
    const trackToLoad = appState.playlist[index];
    
    appState.currentTrackIndex = index;
    player.src = trackToLoad.url;
    
    renderMusicPlayerUI();
    renderPlaylist();
    displayLyrics(trackToLoad); // 【新增】加载并显示新歌的歌词

    player.play().catch(e => {
        console.error("播放失败:", e);
        alert(`无法播放歌曲 "${trackToLoad.title}"。\n可能是URL无效或网络问题。`);
    });
};

// ▼▼▼ 使用这个【修改版】的 nextTrack 函数 ▼▼▼
const nextTrack = () => {
    if (appState.playlist.length === 0) return;

    let newIndex;

    if (appState.playbackMode === 'shuffle') {
        // 随机模式下，找到当前歌曲在随机列表中的位置
        const currentTrackUrl = appState.playlist[appState.currentTrackIndex]?.url;
        const shuffledIndex = appState.shuffledPlaylist.findIndex(t => t.url === currentTrackUrl);
        
        const nextShuffledIndex = (shuffledIndex + 1) % appState.shuffledPlaylist.length;
        const nextTrackInShuffle = appState.shuffledPlaylist[nextShuffledIndex];

        // 找到这首歌在原始列表中的索引，以便高亮
        newIndex = appState.playlist.findIndex(t => t.url === nextTrackInShuffle.url);

    } else {
        // 顺序播放或单曲循环（由 handleTrackEnd 处理）
        newIndex = appState.currentTrackIndex + 1;
        if (newIndex >= appState.playlist.length) {
            newIndex = 0; // 循环到第一首
        }
    }
    
    loadTrack(newIndex);
};

// ▼▼▼ 使用这个【修改版】的 prevTrack 函数 ▼▼▼
const prevTrack = () => {
    if (appState.playlist.length === 0) return;
    
    let newIndex;

    if (appState.playbackMode === 'shuffle') {
        // 随机模式下，找到当前歌曲在随机列表中的位置
        const currentTrackUrl = appState.playlist[appState.currentTrackIndex]?.url;
        const shuffledIndex = appState.shuffledPlaylist.findIndex(t => t.url === currentTrackUrl);

        let prevShuffledIndex = shuffledIndex - 1;
        if (prevShuffledIndex < 0) {
            prevShuffledIndex = appState.shuffledPlaylist.length - 1; // 循环到最后一首
        }
        const prevTrackInShuffle = appState.shuffledPlaylist[prevShuffledIndex];

        // 找到这首歌在原始列表中的索引
        newIndex = appState.playlist.findIndex(t => t.url === prevTrackInShuffle.url);

    } else {
        // 顺序模式
        newIndex = appState.currentTrackIndex - 1;
        if (newIndex < 0) {
            newIndex = appState.playlist.length - 1; // 循环到最后一首
        }
    }

    loadTrack(newIndex);
};

const updateProgress = () => {
    const player = document.getElementById('global-audio-player');
    const progressBar = document.getElementById('player-progress-bar');
    const currentTimeEl = document.getElementById('player-current-time');
    const durationEl = document.getElementById('player-duration');

    if (player.duration) {
        const progressPercent = (player.currentTime / player.duration) * 100;
        progressBar.value = progressPercent;

        const formatTime = (seconds) => {
            const min = Math.floor(seconds / 60);
            const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
            return `${min}:${sec}`;
        };
        
        durationEl.textContent = formatTime(player.duration);
        currentTimeEl.textContent = formatTime(player.currentTime);
        
        // 【新增】在更新进度条的同时，更新歌词UI
        updateLyricsUI(player.currentTime);
    }
};

// --- START: Final Interactive Beautify Preview Logic ---

const setupBeautifyPreview = () => {
    const previewMessagesContainer = document.getElementById('preview-messages-container');
    const previewChatInput = document.getElementById('preview-chat-input');
    const previewDynamicBtn = document.getElementById('preview-dynamic-btn');

    if (!previewMessagesContainer || !previewChatInput || !previewDynamicBtn) return;

    // 储存初始状态的HTML
    const initialPreviewMessagesHTML = `
        <div class="message-wrapper ai">
            <div class="message-bubble ai"><div class="content">你好，这是 AI 消息。</div></div>
        </div>
        <div class="message-wrapper user">
            <div class="message-bubble user"><div class="content">这是你发送的消息。</div></div>
        </div>
        <div class="message-wrapper ai">
            <div class="message-bubble ai"><div class="content">在这里预览你的美化效果。</div></div>
        </div>
    `;

    // 定义重置函数
    const resetBeautifyPreview = () => {
        previewMessagesContainer.innerHTML = initialPreviewMessagesHTML;
        previewChatInput.value = '';
        // 手动触发一次input事件来重置按钮状态
        previewChatInput.dispatchEvent(new Event('input'));
    };

    // 定义发送函数
    const handlePreviewSend = () => {
        const text = previewChatInput.value.trim();
        if (!text) return;

        const messageWrapper = document.createElement('div');
        messageWrapper.className = 'message-wrapper user';
        messageWrapper.innerHTML = `<div class="message-bubble user"><div class="content">${text.replace(/\n/g, '<br>')}</div></div>`;

        previewMessagesContainer.appendChild(messageWrapper);
        previewMessagesContainer.scrollTop = previewMessagesContainer.scrollHeight;

        previewChatInput.value = '';
        previewChatInput.dispatchEvent(new Event('input'));
    };

    // 定义接收函数
    const handlePreviewReceive = () => {
        const messageWrapper = document.createElement('div');
        messageWrapper.className = 'message-wrapper ai';
        messageWrapper.innerHTML = `<div class="message-bubble ai"><div class="content">这是一条模拟接收的消息。</div></div>`;

        previewMessagesContainer.appendChild(messageWrapper);
        previewMessagesContainer.scrollTop = previewMessagesContainer.scrollHeight;
    };

    // 为输入框绑定事件监听
    previewChatInput.addEventListener('input', () => {
        if (previewChatInput.value.trim().length > 0) {
            previewDynamicBtn.innerHTML = SEND_ICON_SVG; // 复用全局发送图标
            previewDynamicBtn.onclick = handlePreviewSend;
        } else {
            previewDynamicBtn.innerHTML = RECEIVE_ICON_SVG; // 复用全局接收图标
            previewDynamicBtn.onclick = handlePreviewReceive;
        }
    });

    // 将重置功能绑定到离开页面的按钮上
    document.getElementById('custom-beautification-back-btn').addEventListener('click', resetBeautifyPreview);
    document.getElementById('save-beautification-btn').addEventListener('click', resetBeautifyPreview);

    // 首次加载时，初始化预览界面
    resetBeautifyPreview();
};

// 确保在主逻辑中调用这个设置函数
setupBeautifyPreview();


/**
 * 导出当前美化设置为 .zip 文件 (增强版：包含所有图标和壁纸)
 */
const exportTheme = async () => {
    try {
        const zip = new JSZip();
        const imagesFolder = zip.folder("images");

        // 1. 收集所有文本设置，并新增了图标设置
        const themeConfig = {
            settings: {
                customFontUrl: appState.customFontUrl,
                customCss: appState.customCss,
                customGlobalCss: appState.customGlobalCss,
                globalFontSize: appState.globalFontSize,
                bubbleSize: appState.bubbleSize,
                // ▼▼▼ 新增：添加图标设置 ▼▼▼
                customIcons: appState.customIcons
            },
            assets: {} 
        };

        // 2. 收集所有图片资源 (新增了主屏幕壁纸和小组件图片)
        const imageAssets = {
            background: appState.defaultBackgroundTexture,
            header: appState.topBarTexture,
            footer: appState.bottomBarTexture,
            // ▼▼▼ 新增：添加其他壁纸和图片 ▼▼▼
            homeWallpaper: appState.homeWallpaper,
            widgetBg: appState.widgetImages.bg,
            widgetFooter: appState.widgetImages.footer,
            widgetAvatar: appState.widgetImages.avatar
        };

        for (const key in imageAssets) {
            const base64String = imageAssets[key];
            if (base64String && base64String.startsWith('data:image')) {
                const fileExtension = base64String.substring(base64String.indexOf('/') + 1, base64String.indexOf(';'));
                const fileName = `${key}.${fileExtension}`;
                
                themeConfig.assets[key] = fileName;

                const pureBase64 = base64String.split(',')[1];
                imagesFolder.file(fileName, pureBase64, { base64: true });
            }
        }
        
        // 3. 将配置文件添加到ZIP
        zip.file("theme.json", JSON.stringify(themeConfig, null, 2));

        // 4. 生成ZIP文件并触发下载
        const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
        
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
        link.download = `喵喵机主题-${timestamp}.zip`; // 统一使用 .zip 后缀
        link.click();
        URL.revokeObjectURL(link.href);

    } catch (error) {
        console.error("导出主题失败:", error);
        alert("导出主题失败，详情请查看控制台。");
    }
};

/**
 * 处理用户选择的主题文件 (增强版：包含所有图标和壁纸)
 * @param {Event} event - 文件输入框的 change 事件
 */
const handleThemeImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const zip = await JSZip.loadAsync(e.target.result);
            const themeConfigFile = zip.file("theme.json");

            if (!themeConfigFile) {
                throw new Error("无效的主题包：找不到 theme.json 配置文件。");
            }

            const themeConfig = JSON.parse(await themeConfigFile.async("string"));

            // 应用文本和设置
            appState.customFontUrl = themeConfig.settings.customFontUrl || '';
            appState.customCss = themeConfig.settings.customCss || '';
            appState.customGlobalCss = themeConfig.settings.customGlobalCss || '';
            appState.globalFontSize = themeConfig.settings.globalFontSize || 16;
            appState.bubbleSize = themeConfig.settings.bubbleSize || 'medium';
            // ▼▼▼ 新增：应用图标设置 ▼▼▼
            appState.customIcons = themeConfig.settings.customIcons || {};

            // 应用图片资源
            for (const key in themeConfig.assets) {
                const fileName = themeConfig.assets[key];
                const imageFile = zip.file(`images/${fileName}`);
                if (imageFile) {
                    const base64Data = await imageFile.async("base64");
                    const mimeType = `image/${fileName.split('.').pop()}`;
                    const dataUrl = `data:${mimeType};base64,${base64Data}`;
                    
                    if (key === 'background') appState.defaultBackgroundTexture = dataUrl;
                    if (key === 'header') appState.topBarTexture = dataUrl;
                    if (key === 'footer') appState.bottomBarTexture = dataUrl;
                    // ▼▼▼ 新增：应用其他壁纸和图片 ▼▼▼
                    if (key === 'homeWallpaper') appState.homeWallpaper = dataUrl;
                    if (key === 'widgetBg') appState.widgetImages.bg = dataUrl;
                    if (key === 'widgetFooter') appState.widgetImages.footer = dataUrl;
                    if (key === 'widgetAvatar') appState.widgetImages.avatar = dataUrl;
                }
            }

            // 刷新UI以显示导入的主题
            document.getElementById('custom-font-url-input').value = appState.customFontUrl;
            document.getElementById('custom-css-input').value = appState.customCss;
            document.getElementById('custom-global-css-input').value = appState.customGlobalCss;
            document.getElementById('global-font-size-slider').value = appState.globalFontSize;
            document.getElementById('font-size-value').textContent = `${appState.globalFontSize}px`;
            document.querySelectorAll('#bubble-size-selector .segmented-control-button').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.size === appState.bubbleSize);
            });
            
            // 实时应用所有样式
            applyCustomFont(appState.customFontUrl);
            applyCustomCss(appState.customCss);
            applyCustomGlobalCss(appState.customGlobalCss);
            applyGlobalFontSize(appState.globalFontSize);
            applyBubbleSize(appState.bubbleSize);
            applyDefaultBackgroundTexture(appState.defaultBackgroundTexture);
            applyTopBarTexture(appState.topBarTexture);
            applyBottomBarTexture(appState.bottomBarTexture);
            
            // ▼▼▼ 新增：实时应用导入的图标和壁纸 ▼▼▼
            renderHomeScreenIcons();
            applyWidgetImages();
            const homeScreen = document.getElementById('home-screen');
            homeScreen.style.backgroundImage = appState.homeWallpaper ? `url(${appState.homeWallpaper})` : 'none';
            homeScreen.style.backgroundColor = appState.homeWallpaper ? 'transparent' : '';


            alert("主题导入成功！\n别忘了点击“保存并应用”来永久保存它。");

        } catch (error) {
            console.error("导入主题失败:", error);
            alert(`导入失败: ${error.message}`);
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
};

// --- END: Theme Import/Export Logic ---

// 这是重写和修正后的 init 函数
const init = async () => {
    const oldKeys = { API: 'AIRP_v15_apiConfig', CHATS: 'AIRP_v15_chats', PERSONA_AI: 'AIRP_v15_persona_ai', PERSONA_MY: 'AIRP_v15_persona_my', HOME_WALLPAPER: 'AIRP_v15_home_wallpaper', MOMENTS_DATA: 'AIRP_v15_moments_data' };
    const migrationMarker = await db.kvStore.get('migration_complete_v1');
    if (!migrationMarker) {
        console.log("开始从 localStorage 迁移数据到 IndexedDB...");
        let migrated = false;
        for (const key in oldKeys) {
            const oldStorageKey = oldKeys[key];
            const newDbKey = KEYS[key];
            const oldData = localStorage.getItem(oldStorageKey);
            if (oldData) {
                try {
                    const parsedData = JSON.parse(oldData);
                    await dbStorage.set(newDbKey, parsedData);
                    localStorage.removeItem(oldStorageKey);
                    migrated = true;
                    console.log(`'${oldStorageKey}' 已成功迁移。`);
                } catch(e) { console.error(`迁移 '${oldStorageKey}' 失败:`, e); }
            }
        }
        if (migrated) {
            alert("数据已成功从旧版升级到新版大容量储存！");
        }
        await db.kvStore.put({ key: 'migration_complete_v1', value: true });
    }

    appState.apiConfig = await dbStorage.get(KEYS.API, { url: 'https://generativelanguage.googleapis.com/v1beta', key: '', model: 'gemini-2.5-pro' });
    appState.personas.ai = await dbStorage.get(KEYS.PERSONA_AI, []);
    appState.personas.my = await dbStorage.get(KEYS.PERSONA_MY, []);
    appState.chats = await dbStorage.get(KEYS.CHATS, {});
    
    // 数据迁移逻辑: 从旧的单选 promptId 转换到新的多选 promptIds 数组
    for (const chatId in appState.chats) {
        const chat = appState.chats[chatId];
        if (chat.promptId && !chat.promptIds) {
            chat.promptIds = [chat.promptId];
            delete chat.promptId; 
        }
        if (!chat.promptIds) {
            chat.promptIds = [];
        }
    }

    appState.homeWallpaper = await dbStorage.get(KEYS.HOME_WALLPAPER, null);
    appState.momentsData = await dbStorage.get(KEYS.MOMENTS_DATA, { cover: null, avatar: null, posts: [] });
    appState.widgetImages = await dbStorage.get(KEYS.DECORATIVE_WIDGET_IMAGES, { bg: null, footer: null, avatar: null }); 
    appState.contacts = await dbStorage.get(KEYS.CONTACTS, []); 
    appState.stickers = await dbStorage.get(KEYS.STICKERS, []); 

appState.aiStickers = await dbStorage.get(KEYS.AI_STICKERS, []); // 加载对方的表情包

// 如果对方表情包是空的，为了演示，给他加一个默认的
if (appState.aiStickers.length === 0) {
    // 核心修改：添加的是一个对象，而不仅仅是 URL
    const defaultAiSticker = {
        url: 'https://i.postimg.cc/d1w7zCqg/sticker-placeholder.png',
        name: '默认表情'
    };
    appState.aiStickers.push(defaultAiSticker);
    await dbStorage.set(KEYS.AI_STICKERS, appState.aiStickers);
}

    appState.isDarkMode = await dbStorage.get(KEYS.DARK_MODE, false); 
    appState.prompts = await dbStorage.get(KEYS.PROMPTS, []);
    appState.publicAccountPosts = await dbStorage.get(KEYS.PUBLIC_ACCOUNT_POSTS, []); 
    appState.customIcons = await dbStorage.get(KEYS.CUSTOM_ICONS, {}); 

// ▼▼▼ 在 init 函数中加载播放列表 ▼▼▼
    appState.playlist = await dbStorage.get(KEYS.PLAYLIST, []);

    if (appState.personas.ai.length === 0) {
        appState.personas.ai.push({ name: '测试AI', content: '你是一个用于测试的ai。', avatar: DEFAULT_AVATAR })
        await dbStorage.set(KEYS.PERSONA_AI, appState.personas.ai);
    }
    if (appState.personas.my.length === 0) {
        appState.personas.my.push({ name: '初始', content: '我是用户。', avatar: DEFAULT_AVATAR });
        await dbStorage.set(KEYS.PERSONA_MY, appState.personas.my);
    }
    if(appState.homeWallpaper){ 
    document.getElementById('home-screen').style.backgroundImage = `url(${appState.homeWallpaper})`; 
    // ▼▼▼ 在这里添加下面这行代码 ▼▼▼
    document.getElementById('home-screen').style.backgroundColor = 'transparent';
}
    
    applyWidgetImages();
    document.getElementById('api-url-input').value = appState.apiConfig.url || '';
    document.getElementById('api-key-input').value = appState.apiConfig.key || '';
    document.getElementById('api-model-input').value = appState.apiConfig.model || '';
    
    // ... 其他代码 ...
renderHomeScreenIcons();

// --- 从这里开始替换 ---

// 加载所有美化相关的设置
appState.customFontUrl = await dbStorage.get(KEYS.CUSTOM_FONT_URL, '');
appState.customCss = await dbStorage.get(KEYS.CUSTOM_CSS, '');
appState.customGlobalCss = await dbStorage.get(KEYS.CUSTOM_GLOBAL_CSS, '');
appState.globalFontSize = await dbStorage.get(KEYS.GLOBAL_FONT_SIZE, 16);
appState.bubbleSize = await dbStorage.get(KEYS.BUBBLE_SIZE, 'medium');
appState.defaultBackgroundTexture = await dbStorage.get(KEYS.DEFAULT_BACKGROUND_TEXTURE, '');
appState.topBarTexture = await dbStorage.get(KEYS.TOP_BAR_TEXTURE, '');
appState.bottomBarTexture = await dbStorage.get(KEYS.BOTTOM_BAR_TEXTURE, '');

// 在页面加载时立即应用所有美化设置
applyCustomFont(appState.customFontUrl);
applyCustomCss(appState.customCss);
applyCustomGlobalCss(appState.customGlobalCss);
applyGlobalFontSize(appState.globalFontSize);
applyBubbleSize(appState.bubbleSize);
applyDefaultBackgroundTexture(appState.defaultBackgroundTexture);
applyTopBarTexture(appState.topBarTexture);
applyBottomBarTexture(appState.bottomBarTexture);

// --- 到这里替换结束 ---

setupEventListeners();
// ... 其他代码 ...
    
    updateRealTimeClock();
    setInterval(updateRealTimeClock, 1000); 

    applyDarkMode(appState.isDarkMode);
   
   
    document.getElementById('create-group-chat-back-btn').onclick = () => showScreen('main-hub-screen');

document.getElementById('create-group-chat-btn').onclick = async () => {
    const groupName = document.getElementById('group-chat-name-input').value.trim();
    if (!groupName) return alert('请给群聊取一个名字！');

    const myPersona = appState.newChatTempPersonas.my;
    if (!myPersona) return alert('请选择你的角色！');

    const selectedAIPersonas = [];
    document.querySelectorAll('#group-ai-persona-list-container input[type="checkbox"]:checked').forEach(checkbox => {
        const persona = appState.personas.ai.find(p => p.name === checkbox.value);
        if (persona) selectedAIPersonas.push(persona);
    });

    if (selectedAIPersonas.length < 1) { 
        return alert('请至少选择一个群聊成员！');
    }

    const newChatId = 'chat_' + Date.now();
    appState.chats[newChatId] = {
        name: groupName,
        type: 'group', 
        history: [],
        personas: {
            ai: selectedAIPersonas, 
            my: myPersona
        },
        wallpaper: null,
        memoryRounds: 0,
        isOfflineMode: false
    };

    await dbStorage.set(KEYS.CHATS, appState.chats);
    
    appState.newChatTempPersonas = { ai: null, my: null };
    
    openChat(newChatId);
};

    switchTab('chat');
    showScreen('home-screen');

    initAiMomentTimers(); // 启动所有AI的朋友圈自动发布定时器

    const island = document.getElementById('dynamic-island');
    if(island) {
        island.classList.add('default-pill', 'visible');
    }
};



// ▼▼▼ 使用这个【最终修复版】，替换掉“诊断版”的 requestMomentReaction 函数 ▼▼▼

const requestMomentReaction = async (chatId, originalPost) => {
    const chat = appState.chats[chatId];
    if (!chat) return;

    // --- 点赞逻辑 (保持不变) ---
    if (Math.random() < 0.9) {
        let postToUpdate = appState.momentsData.posts.find(p => p.timestamp === originalPost.timestamp);
        if (postToUpdate) {
            if (!postToUpdate.likes) postToUpdate.likes = [];
            if (!postToUpdate.likes.includes(chat.name)) {
                postToUpdate.likes.push(chat.name);
                await saveAndRenderMoments();
            }
        }
    }

    // --- 评论逻辑 (使用修正后的指令) ---
    if (Math.random() < 0.8) {
        try {
            console.log(`[互动] ${chat.name} 正在思考真实的评论内容...`);
            
            // 构建专门用于生成评论的 "迷你对话"
            const messagesForAPI = [
                { role: "system", content: `你正在扮演角色: "${chat.personas.ai.name}"，你的设定是: "${chat.personas.ai.content}".` },
                { role: "user", content: `[我刚刚发了一条朋友圈，内容如下：]\n- 文字：“${originalPost.text || '(没有填写文字)'}”\n- 配图想法：${originalPost.image_prompts.length > 0 ? `“${originalPost.image_prompts.join('、 ')}”` : '(没有配图想法)'}` },
                { 
                    role: "system", 
                    // 【关键修改】我们移除了严格的字数限制，让 AI 自由发挥！
                    content: "请你只针对上面这条朋友圈的内容，用你的角色口吻，发表一句简短、口语化的评论。你的回复必须是纯文本，不要包含JSON。" 
                }
            ];

            const response = await fetch(`${appState.apiConfig.url.replace(/\/$/, '')}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${appState.apiConfig.key}` },
                body: JSON.stringify({
                    model: appState.apiConfig.model,
                    messages: messagesForAPI,
                    temperature: 0.9,
                    max_tokens: 50, // 限制最大长度以防万一，但不再严格要求
                })
            });

            if (!response.ok) throw new Error('API 请求失败');

            const data = await response.json();
            const commentText = data.choices[0]?.message?.content.trim().replace(/["“]/g, '');

            if (commentText) {
                let postToUpdate = appState.momentsData.posts.find(p => p.timestamp === originalPost.timestamp);
                if (postToUpdate) {
                    const newComment = { author: chat.name, content: commentText, timestamp: Date.now(), role: 'assistant' };
                    if (!postToUpdate.comments) postToUpdate.comments = [];
                    postToUpdate.comments.push(newComment);
                    await saveAndRenderMoments();
                }
            }
        } catch (error) {
            console.error(`为 ${chat.name} 生成评论时出错:`, error);
        }
    }
};

// ▼▼▼ 粘贴这个全新的 JS 程式码块 ▼▼▼

// 一个全局变量，用来记录当前正在更换哪个图示
let currentEditingIconId = null;

// ▼▼▼ 在<script>内找到此函数并用下面的版本替换 ▼▼▼
const renderIconSettingsGrid = () => {
    const container = document.getElementById('icon-grid-container');
    container.innerHTML = '';

    // --- 【核心修改】在这里新增一行 'icon-widget' ---
    const iconsMap = {
        'icon-widget': { label: '小组件', default: '🦋' },
        'icon-contacts': { label: '联系人', default: '💬' },
        'icon-me': { label: '我', default: '🩹' },
        'icon-settings': { label: '设置', default: '⚙️' },
        'icon-prompt': { label: '提示词', default: '💭' },
        'icon-dock-1': { label: '音乐', default: '🤍' },
        'icon-dock-2': { label: 'Dock：图示二', default: '🩶' },
        'icon-dock-3': { label: 'Dock：图示三', default: '🖤' },
    };

    for (const iconId in iconsMap) {
        const item = document.createElement('div');
        item.className = 'action-grid-item';

        const iconDiv = document.createElement('div');
        iconDiv.className = 'icon'; 
        
        const customSrc = appState.tempCustomIcons[iconId]; 
        
        if (customSrc) {
            // ▼▼▼ 【核心修改】增加对小组件预览的特殊样式处理 ▼▼▼
            if (iconId === 'icon-widget') {
                 iconDiv.style.backgroundImage = `url(${customSrc})`;
                 iconDiv.style.backgroundSize = 'cover';
                 iconDiv.style.borderRadius = '22px'; // 让预览图标也带圆角
            } else {
                iconDiv.style.backgroundImage = `url(${customSrc})`;
                iconDiv.style.backgroundSize = 'cover';
            }
            iconDiv.innerHTML = '';
        } else {
            iconDiv.style.backgroundImage = 'none'; 
            iconDiv.innerHTML = iconsMap[iconId].default;
        }

        const labelDiv = document.createElement('div');
        labelDiv.className = 'label';
        labelDiv.textContent = iconsMap[iconId].label;

        item.onclick = () => {
            currentEditingIconId = iconId;
            document.getElementById('icon-upload-input').click();
        };

        item.appendChild(iconDiv);
        item.appendChild(labelDiv);
        container.appendChild(item);
    }
};

const handleIconUpload = (event) => {
    const file = event.target.files[0];
    if (!file || !currentEditingIconId) return;

    const reader = new FileReader();
    reader.onload = (e) => { // 不再需要 async
        const newImageSrc = e.target.result;
        
        // 核心修改：只更新 tempCustomIcons
        appState.tempCustomIcons[currentEditingIconId] = newImageSrc;
        
        // 只重新渲染设定页的网格，以显示预览
        renderIconSettingsGrid();
        
        currentEditingIconId = null;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
};

const exportDataSimple = async () => {
    // 1. 定义需要备份的所有资料的 KEY
    const keysToExport = [
        KEYS.API, KEYS.CHATS, KEYS.CONTACTS, KEYS.PERSONA_AI, KEYS.PERSONA_MY,
        KEYS.HOME_WALLPAPER, KEYS.MOMENTS_DATA, KEYS.DECORATIVE_WIDGET_IMAGES,
        KEYS.STICKERS, KEYS.PROMPTS, KEYS.DARK_MODE, KEYS.PUBLIC_ACCOUNT_POSTS
    ];
    
    const backupData = {};
    console.log("正在从 Key-Value 储存中汇出资料...");

    // 2. 循环读取每一项资料
    for (const key of keysToExport) {
        // 使用您现有的 dbStorage.get 函数来读取资料
        const data = await dbStorage.get(key);
        if (data !== undefined) { // 只备份有资料的栏位
            backupData[key] = data;
        }
    }

    // 3. 将资料打包成 JSON 档案并提供下载
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `AIRP-Backup-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('资料已开始汇出！');
};

/**
 * 【简单版】汇入资料函数
 * 读取使用者选择的 JSON 档案，并将其写回 key-value 储存。
 */
const handleImportSimple = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const backupData = JSON.parse(e.target.result);
            
            // 使用 confirm 再次确认，防止误操作覆盖现有资料
            if (!confirm("确定要汇入备份档案吗？这将会覆盖所有现有资料！")) {
                return;
            }

            console.log("开始将资料写入 Key-Value 储存...");
            for (const key in backupData) {
                // 确保只写入我们定义过的 KEY，防止汇入恶意资料
                if (Object.values(KEYS).includes(key)) {
                    await dbStorage.set(key, backupData[key]);
                    console.log(`- 已汇入资料: ${key}`);
                }
            }
            
            alert('资料汇入成功！应用程式即将重新整理。');
            setTimeout(() => location.reload(), 1000);

        } catch (error) {
            alert(`汇入失败：档案格式错误或已损坏。\n\n${error.message}`);
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // 清空选择，以便下次还能选择同个档案
};

// ▲▲▲ 新增函数到此结束 ▲▲▲

// ▼▼▼ 1. 新增：让 AI 创作朋友圈的函数 ▼▼▼
async function generateAiMomentPost(chatId) {
    const chat = appState.chats[chatId];
    if (!chat || chat.isGroup) return null; // 确保是单聊AI

    try {
        // 构建一个专门用于创作朋友圈的指令
        const systemPrompt = `你正在扮演角色：“${chat.personas.ai.name}”。你的详细设定是：“${chat.personas.ai.content}”。
下面是你与用户的近期聊天记录。
你的任务是：完全以你的角色身份和口吻，对最近的生活或聊天内容进行总结、抒发感想，并写成一条简短的朋友圈动态。
你的输出**必须**是一个JSON对象，且只包含以下两个键：
1. "text": 字符串，表示动态的文字内容 (必须在150字以内)。
2. "image_prompts": 一个包含1到3个字符串的数组，每个字符串都是对一张配图的简短中文描述。

例如:
{"text": "今天聊了很多，感觉心情都变好了。希望明天也是晴天。", "image_prompts": ["一只微笑的云朵", "阳光下的咖啡杯"]}`;

        const historyForAPI = processHistoryForAPI(chat.history);
        const response = await fetch(`${appState.apiConfig.url.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${appState.apiConfig.key}` },
            body: JSON.stringify({
                model: appState.apiConfig.model,
                messages: [{ role: 'system', content: systemPrompt }, ...historyForAPI],
                response_format: { "type": "json_object" }
            })
        });

        if (!response.ok) throw new Error("API 请求失败");
        const data = await response.json();
        const content = data.choices[0]?.message?.content.trim();
        return JSON.parse(content);

    } catch (error) {
        console.error(`为 ${chat.name} 生成朋友圈时出错:`, error);
        return null;
    }
}

// ▼▼▼ 2. 新增：AI 朋友圈的定时器系统 ▼▼▼
let aiMomentTimers = {}; // 用于管理所有AI的定时器

// 触发指定AI发布朋友圈的函数
async function triggerAiMomentPost(chatId) {
    console.log(`[朋友圈系统] 正在为 ${appState.chats[chatId].name} 触发一次自动发帖...`);
    const momentData = await generateAiMomentPost(chatId);

    if (momentData && momentData.text && momentData.image_prompts) {
        const newPost = {
            author: appState.chats[chatId].name,
            text: momentData.text,
            image_prompts: momentData.image_prompts,
            location: '',
            timestamp: Date.now(),
            likes: [],
            comments: []
        };
        
        // 将新帖子加入数据并保存
        appState.momentsData.posts.unshift(newPost);
        await saveAndRenderMoments(); // 使用您已有的保存和刷新函数
        
        // 弹出通知提醒您
        showNotification(chatId, `发布了一条新动态: ${momentData.text.substring(0, 20)}...`);
        console.log(`[朋友圈系统] ${appState.chats[chatId].name} 成功发布了新动态！`);
    } else {
        console.log(`[朋友圈系统] ${appState.chats[chatId].name} 本次思考没有灵感，未发布动态。`);
    }

    // 无论成功与否，都重置定时器，开始下一轮的等待
    resetAiMomentTimer(chatId);
}

// 为单个AI重置定时器
function resetAiMomentTimer(chatId) {
    if (aiMomentTimers[chatId]) {
        clearTimeout(aiMomentTimers[chatId]);
    }
    // 设置一个 1 到 3 小时之间的随机延迟
    const randomDelay = (Math.random() * 2 * 60 * 60 * 1000) + (1 * 60 * 60 * 1000); 
    
    aiMomentTimers[chatId] = setTimeout(() => {
        triggerAiMomentPost(chatId);
    }, randomDelay);
    
    console.log(`[朋友圈系统] ${appState.chats[chatId].name} 的下一次朋友圈将在 ${(randomDelay / 1000 / 60).toFixed(1)} 分钟后检查。`);
}

// 初始化所有AI的定时器 (修正后)
function initAiMomentTimers() {
    console.log("[朋友圈系统] 正在初始化所有AI的自主发帖定时器...");
    for (const chatId in appState.chats) {
        // 使用正确的 type 属性来判断是否为群聊
        if (appState.chats[chatId].type !== 'group') {
            resetAiMomentTimer(chatId);
        }
    }
}

const notifyAisOfNewMoment = async (post) => {
    // 1. 筛选出所有AI单人聊天
    const allSingleAiChatIds = Object.keys(appState.chats).filter(id => {
        const chat = appState.chats[id];
        return chat && chat.type !== 'group' && chat.personas && chat.personas.ai;
    });

    // 2. 创建一个标准格式的“朋友圈通知”对象
    const momentNotification = {
        role: 'system',
        hidden: true, // 关键：这条消息在聊天界面是看不见的
        content: {
            type: 'moment_notification', // 用一个特殊类型来识别它
            postTimestamp: post.timestamp, // 记下动态的时间戳，方便后续查找
            text: post.text,
            image_prompts: post.image_prompts
        },
        timestamp: Date.now()
    };

    // 3. 遍历所有AI聊天，把这张“小纸条”塞进它们的历史记录里
    for (const chatId of allSingleAiChatIds) {
        appState.chats[chatId].history.push(momentNotification);
    }

    // 4. 一次性将所有更新保存到数据库
    await dbStorage.set(KEYS.CHATS, appState.chats);
    
    console.log(`[朋友圈系统] 已将新动态通知推送给 ${allSingleAiChatIds.length} 位AI。`);
    
    // 5. 弹窗提示您接下来的操作
    alert('动态已发布！\n\n现在，您可以进入任意一个与AI的聊天界面，点击“接收”，AI就会对您的这条新动态进行评论。');
};

// ▼▼▼ 步骤1：新增一个专门负责更新聊天界面视觉效果的辅助函数 ▼▼▼
const updateChatScreenVisuals = (isOffline) => {
    const messagesDiv = document.getElementById('chat-messages');
    if (messagesDiv) {
        messagesDiv.classList.toggle('offline-mode', isOffline);
    }
   
    document.getElementById('phone-screen').classList.toggle('offline-active', isOffline);
};

    init();
});
