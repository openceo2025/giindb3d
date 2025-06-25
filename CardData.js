// CardData.js

export class CardData {
    constructor(initialData = null) {
        if (initialData) {
            this.items = initialData;
            this.saveLocalStorage(); // 初期データをローカルストレージに保存
        } else {
            let storedData = localStorage.getItem('cardData');
            if (storedData) {
                this.items = JSON.parse(storedData);
            } else {
                this.items = {};
                this.addInitialCardTocardData();
            }
        }
    }

    // JSONデータとして保存できるようにオブジェクトを取得
    toJSON() {
        return JSON.stringify(this.items, null, 4); // 4つのスペースでインデント
    }

    // localStorageに保存するメソッド
    saveLocalStorage() {
        //localStorage.setItem('cardData', this.toJSON());
    }

    // 初期データを設定するメソッド
    addInitialCardTocardData() {
        let key = crypto.randomUUID();
        this.items[key] = {
            title: "タイトル", 
            detail: "本文", 
            type: "text",//text,img-text,img,video-text,video
            position: {
                free: {x: 0, y: 0, z: 0},
                theme: {x: 0, y: 0, z: 0},
                map: {x: 0, y: 0, z: 0},
                aiueo: {x: 0, y: 0, z: 0},
                politicalParty: {x: 0, y: 0, z: 0},
            },
            color: { // 追加
                theme: "#007f7f",
                map: "#007f7f",
                aiueo: "#007f7f",
                politicalParty: "#007f7f",
                free: "#007f7f" // 他の arrangeMode がある場合はここに追加
            },
            childrenInfo: {
                camera: null,
                cards: {}
            },
            img: null,
            video: null,
            timestamp: Date.now()
        };
        return key;
    }

    // カードデータ連想配列を取得するメソッド
    getItems() {
        return this.items;
    }

    // カードデータを取得するメソッド
    getItem(key) {
        return this.items[key]; // keyに対応するアイテムを返す
    }

    // カードデータを削除するメソッド
    deleteItem(key) {
        if (this.items[key]) {
            delete this.items[key]; // オブジェクトからキーを削除
            this.saveLocalStorage(); // 削除後にlocalStorageに保存
        } else {
            console.warn(`Item with key "${key}" does not exist.`);
        }
    }

    // --- 追加1：downloadJSON メソッド ---
    downloadJSON() {
        const jsonData = this.toJSON();
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // 一時的なリンク要素を作成
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cardData.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // --- 追加2：uploadJSON メソッド ---
    uploadJSON() {
        // ファイル選択ダイアログを動的に表示
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';

        // ファイルが選択されたときの処理
        input.addEventListener('change', () => {
            const file = input.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const data = JSON.parse(reader.result);
                        this.initialize(data); // データを初期化
                        this.saveLocalStorage();
                        location.reload();
                    } catch (error) {
                        alert('JSONファイルの読み込みに失敗しました。');
                        console.error('JSON parsing error:', error);
                    }
                };
                reader.readAsText(file);
            }
        });

        // ファイル選択ダイアログを表示
        input.click();
    }

    // --- initialize メソッド ---
    initialize(data) {
        this.items = data;
        this.saveLocalStorage();
    }
}
