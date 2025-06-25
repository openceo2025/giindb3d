// modalEditor.js

export class ModalEditor {
    constructor(options = {}) {
        this.options = options;
        this.createStyles();
        this.createModal();
        this.initPickr(); // initPickr メソッドを追加
        this.modalContent;
        this.imageDropZone;
        this.videoDropZone;
        this.typeSelection; // タイプ選択用のラジオボタンを保持
    }

    // 必要なCSSスタイルをインジェクト
    createStyles() {
        if (!document.querySelector('link[href*="pickr.min.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = './libs/themes/monolith.min.css'; // Pickrのローカルパスに変更
            document.head.appendChild(link);
        }

        const style = document.createElement('style');
        style.textContent = `
            .modal {
                display: none; 
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                overflow: auto;
                background-color: rgba(0,0,0,0.5); 
            }
            .modal-content {
                background-color: #fff;
                margin: 5% auto; 
                padding: 20px;
                width: 500px;
                max-width: 90%;
                border-radius: 5px;
                text-align: center;
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            .modal-content h2 {
                margin-bottom: 20px;
                color: black;
            }
            #color-picker {
                width: 100%;
                max-width: 450px;
                height: 300px;
            }
            .file-drop-zone {
                border: 2px dashed #ccc;
                padding: 20px;
                width: 100%;
                max-width: 450px;
                margin-top: 20px;
                text-align: center;
                color: #888;
                cursor: pointer;
            }
            .button-container {
                margin-top: 20px;
                display: flex;
                justify-content: space-around;
                width: 100%;
                max-width: 450px;
            }
            #confirmBtn, #cancelBtn {
                padding: 10px 20px;
                font-size: 16px;
                cursor: pointer;
                border: none;
                border-radius: 4px;
                flex: 1;
                margin: 0 10px;
            }
            #confirmBtn {
                background-color: #4CAF50;
                color: white;
            }
            #cancelBtn {
                background-color: #f44336;
                color: white;
            }
            #confirmBtn:hover {
                background-color: #45a049;
            }
            #cancelBtn:hover {
                background-color: #da190b;
            }
            .radio-group {
                display: flex;
                justify-content: space-around;
                width: 100%;
                margin-top: 20px;
            }
            .radio-group input[type="radio"] {
                margin-right: 10px;
            }
            .radio-group label {
                color: black; /* テキストの色を黒に設定 */
                margin-right: 20px;
                cursor: pointer;
            }
            @media (max-width: 600px) {
                .modal-content {
                    width: 90%;
                }
                #color-picker {
                    height: 250px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // モーダルダイアログと必要なDOM要素を作成
    createModal() {
        this.modal = document.createElement('div');
        this.modal.id = 'modalEditor';
        this.modal.classList.add('modal');

        this.modalContent = document.createElement('div');
        this.modalContent.classList.add('modal-content');

        const title = document.createElement('h2');
        title.textContent = '詳細編集';

        const colorPickerContainer = document.createElement('div');
        colorPickerContainer.id = 'color-picker';

        // ファイル選択用のゾーンを追加
        this.imageDropZone = document.createElement('div');
        this.imageDropZone.classList.add('file-drop-zone');
        this.imageDropZone.textContent = '画像をドラッグ＆ドロップ';

        this.videoDropZone = document.createElement('div');
        this.videoDropZone.classList.add('file-drop-zone');
        this.videoDropZone.textContent = '動画をドラッグ＆ドロップ';

        // タイプ選択用のラジオボタンを追加
        this.typeSelection = document.createElement('div');  // プロパティ化
        this.typeSelection.classList.add('radio-group');
        const types = ['text', 'img-text', 'img', 'video-text', 'video'];
        types.forEach(type => {
            const label = document.createElement('label');
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'cardType';
            radio.value = type;
            label.appendChild(radio);
            label.append(type);
            this.typeSelection.appendChild(label);
        });

        const buttonContainer = document.createElement('div');
        buttonContainer.classList.add('button-container');

        const confirmBtn = document.createElement('button');
        confirmBtn.id = 'confirmBtn';
        confirmBtn.textContent = '確定';

        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancelBtn';
        cancelBtn.textContent = 'キャンセル';

        buttonContainer.appendChild(confirmBtn);
        buttonContainer.appendChild(cancelBtn);

        this.modalContent.appendChild(title);
        this.modalContent.appendChild(colorPickerContainer);
        this.modalContent.appendChild(this.imageDropZone);
        this.modalContent.appendChild(this.videoDropZone);
        this.modalContent.appendChild(this.typeSelection);
        this.modalContent.appendChild(buttonContainer);
        this.modal.appendChild(this.modalContent);
        document.body.appendChild(this.modal);

        confirmBtn.addEventListener('click', () => {
            const color = this.pickr.getColor();
            if (color) {
                const selectedColor = color.toHEXA().toString();
                this.onConfirm(selectedColor);
                this.closeModal();
            }
        });

        cancelBtn.addEventListener('click', () => {
            this.onCancel();
            this.closeModal();
        });

        this.imageDropZone.addEventListener('click', () => this.onImageSelect());
        this.videoDropZone.addEventListener('click', () => this.onVideoSelect());

        this.imageDropZone.addEventListener('dragover', (event) => {
            event.preventDefault();
        });
        this.videoDropZone.addEventListener('dragover', (event) => {
            event.preventDefault();
        });

        this.imageDropZone.addEventListener('drop', (event) => {
            event.preventDefault();
            const file = event.dataTransfer.files[0];
            this.onImageDrop(file);
        });

        this.videoDropZone.addEventListener('drop', (event) => {
            event.preventDefault();
            const file = event.dataTransfer.files[0];
            this.onVideoDrop(file);
        });

        window.addEventListener('click', (event) => {
            if (event.target === this.modal) {
                this.onCancel();
                this.closeModal();
            }
        });
    }

    getSelectedType() {
        // ラジオボタンのグループを取得
        const radios = this.typeSelection.querySelectorAll('input[name="cardType"]');
        
        // どれがチェックされているかを確認し、選択されているラジオボタンの値を返す
        for (let radio of radios) {
            if (radio.checked) {
                return radio.value;  // checkedがtrueになっているラジオボタンの値を返す
            }
        }
        
        // 何も選択されていない場合、nullやデフォルト値を返す
        return null;
    }

    // Pickrインスタンスの初期化
    initPickr() {
        if (typeof Pickr === 'undefined') {
            console.error('Pickrがロードされていません。index.htmlで pickr.es5.min.js を正しく読み込んでください。');
            return;
        }

        this.pickr = Pickr.create({
            el: '#color-picker',
            theme: 'monolith', 
            default: '#42445a',

            components: {
                preview: true,
                opacity: true,
                hue: true,

                interaction: {
                    hex: true,
                    rgba: true,
                    hsla: true,
                    input: true,
                    save: false,
                    cancel: false,
                    clear: false
                }
            }
        });
    }

    // モーダルを開くメソッド
    openModal(nowColor, nowImg, nowVideo, nowType) {
        // カラーを設定する（Pickr の setColor メソッドを使用）
        if (nowColor && this.pickr) {
            this.pickr.setColor(nowColor); // Pickr の setColor メソッド
        }
    
        // 画像の初期表示を設定
        if (nowImg && this.imageDropZone) {
            this.imageDropZone.textContent = nowImg;
        }else{
            this.imageDropZone.textContent = "画像をドロップしてくだしあ";
        }
    
        // 動画の初期表示を設定
        if (nowVideo && this.videoDropZone) {
            this.videoDropZone.textContent = nowVideo;
        }else(
            this.videoDropZone.textContent = "動画をどろっぷしてくだしあ"
        )
    
        // カードタイプを設定する
        if(this.typeSelection){
            const radioButtons = this.typeSelection.querySelectorAll('input[name="cardType"]');
            if(nowType){
                radioButtons.forEach(radio => {
                    radio.checked = (radio.value === nowType);
                });
            }else{
                radioButtons.forEach(radio => {
                    radio.checked = (radio.value === "text");
                });
            }

        }
            
        // モーダルを表示
        this.modal.style.display = 'block';
    }

    // モーダルを閉じるメソッド
    closeModal() {
        this.modal.style.display = 'none';
    }

    // 確定が押されたときのコールバック
    onConfirm(color) {
        if (this.options.onConfirm) {
            this.options.onConfirm(color, this.imageDropZone.textContent, this.videoDropZone.textContent, this.getSelectedType());
        }
    }

    // キャンセルが押されたときのコールバック
    onCancel() {
        if (this.options.onCancel) {
            this.options.onCancel();
        }
    }

    // 画像選択時のコールバック
    onImageSelect() {
        if (this.options.onImageSelect) {
            this.options.onImageSelect();
        }
    }

    // 動画選択時のコールバック
    onVideoSelect() {
        if (this.options.onVideoSelect) {
            this.options.onVideoSelect();
        }
    }

    // 画像がドロップされた時のコールバック
    onImageDrop(file) {
        console.log(file);
        this.imageDropZone.textContent = file.name;
        if (this.options.onImageDrop) {
            this.options.onImageDrop(file);
        }
    }

    // 動画がドロップされた時のコールバック
    onVideoDrop(file) {
        console.log(file);
        this.videoDropZone.textContent = file.name;
        if (this.options.onVideoDrop) {
            this.options.onVideoDrop(file);
        }
    }
}
