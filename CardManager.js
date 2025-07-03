import * as THREE from 'three';
import TWEEN from 'three/addons/libs/tween.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CardCamera } from 'CardCamera';
import { ModalEditor } from './modalEditor.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'; // SVGLoaderをインポート

// 政党名の表記ゆれを吸収するマップ
const PARTY_KEY_MAP = {
    "自民": "zimin",
    "自由民主党": "zimin",
    "公明": "koumei",
    "立憲": "rikken",
    "維新": "ishin",
    "共産": "kyousan",
    "国民": "kokumin",
    "れいわ": "reiwa",
    "社民": "shamin",
    "社会民主党": "shamin",
    "NHK": "nkoku",
    "参政": "sansei",
    "日保": "nippo",
    "日本保守党": "nippo",
    "日本保守党（代表者：百田尚樹）": "nippo",
    "日本保守党（代表者：石濱哲信）": "nippo",
    "日誠": "nissei",
    "日本誠真会": "nissei",
    "日家": "nichiie",
    "日本の家庭を守る会": "nichiie",
    "やまと": "yamato",
    "新党やまと": "yamato",
    "差別": "sabetsu",
    "差別撲滅党#平和フリーズ": "sabetsu",
    "核融": "kakuyu",
    "核融合党": "kakuyu",
    "減日": "genzei",
    "減税日本": "genzei",
    "くにもり": "kunimori",
    "新党くにもり": "kunimori",
    "多夫多妻": "tafu",
    "多夫多妻党": "tafu",
    "国ガ": "kokuga",
    "国政ガバナンスの会": "kokuga",
    "新社": "shinsha",
    "新社会党": "shinsha",
    "みんつく": "mintsuku",
    "N国": "nkoku",
    "再道": "saidou",
    "みらい": "mirai",
    "日改": "nikai",
    "無所属": "mushozoku",
    "諸派": "shoha",
    "みんな": "mintsuku",
    "安死": "anshi",
    "": "fumei",
    "不明": "fumei",
};

// 政党IDからカラーコードを取得するマップ
const PARTY_COLOR_MAP = {
    zimin: "#3CA324",
    koumei: "#F55881",
    rikken: "#184589",
    ishin: "#6FBA2C",
    kyousan: "#DB001C",
    kokumin: "#F8BC00",
    reiwa: "#E4027E",
    shamin: "#01A8EC",
    sansei: "#D85D0F",
    nippo: "#D3D3D3",
    mintsuku: "#F8EA0D",
    nkoku: "#000000",
    saidou: "#000000",
    mirai: "#000000",
    nikai: "#000000",
    nissei: "#000000",
    nichiie: "#000000",
    yamato: "#000000",
    sabetsu: "#000000",
    kakuyu: "#000000",
    genzei: "#000000",
    kunimori: "#000000",
    tafu: "#000000",
    kokuga: "#000000",
    shinsha: "#000000",
    mushozoku: "#DFDFDF",
    shoha: "#D3D3D3",
    fumei: "#000000",
    anshi: "#D3D3D3",
};

// Color codes used when highlighting candidates with special issues
const TUBO_COLOR = "#ff0000";      // 統一教会関連
const URAGANE_COLOR = "#ff31ba";   // 裏金関連
const BOTH_COLOR = "#800080";      // 両方該当する場合
const NO_ISSUE_COLOR = "#000000";  // 壺・裏金情報なし

export class CardManager {
    constructor(cardData) {
        this.previousKeys = [];
        this.giinDB = false;
        this.anchorCard = null;
        this.targetSetSession = false;
        this.cameraMoving = false;
        this.prefectureData = {}; // 県名とIDを保持する辞書
        this.selectedPrefecture = "";
        // ModalEditorは引き続き使用
        this.currentSelectedCardKey = null;

        //詳細情報表示エリア
        this.detailDisplay = document.getElementById('detaildisplay');
        this.closeButton = document.getElementById('close-button');
        this.textArea = document.getElementById('detail-textarea'); // テキストエリアの参照
        this.detailButtons = document.querySelectorAll('.detail-button'); // ボタンの参照        

        //

        // カメラ
        this.camera = new CardCamera();
        this.cardTweenGroup = new TWEEN.Group();

        // シーン
        this.scene = new THREE.Scene();

        // WebGLRenderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000, 1); // 背景色
        document.getElementById('container').appendChild(this.renderer.domElement);

        // 日本地図の読み込み
        this.mapObjects = {};
        this.loadJapanMap(); // 日本地図の読み込みメソッドを呼び出す

        this.waku = {};
        this.createWaku();

        // コントロール
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.minDistance = 1;
        this.controls.maxDistance = 100000;
        this.controls.addEventListener('change', this.render.bind(this));

        this.controls.enableRotate = false;
        this.controls.enableZoom = true;
        this.controls.enablePan = true;

        // まずはオリジナルのraycastメソッドを保持
        const originalRaycast = THREE.Mesh.prototype.raycast;

        // THREE.Meshのraycastメソッドをオーバーライド
        THREE.Mesh.prototype.raycast = function(raycaster, intersects) {
            // visibleがfalseか、opacityが0の場合はraycastしない
            if (!this.visible || (this.material && this.material.opacity === 0)) {
                return;
            }
            // それ以外の場合は、通常のraycast処理を実行
            originalRaycast.call(this, raycaster, intersects);
        };
        this.mouse = new THREE.Vector2();        // マウス位置もクラスのメンバとして定義

        // ドラッグ関連
        this.clickTimer = null;
        this.handleStartTimer = null;
        this.draggedObject = null;
        this.selectedObject = null;
        this.isDragging = false;
        this.IsHandleStart = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.bairitsu = 5;

        // 政党カラー取得用マップ
        this.partyKeyMap = PARTY_KEY_MAP;
        this.partyColorMap = PARTY_COLOR_MAP;

        this.cardData = cardData;
        this.threeObjects = [];
        this.targets = { theme: [], map: [], aiueo: [], politicalParty: [], sphere: [], helix: [], tile: [], tag: [], gantt: [], today: [], calendar: [], free: [] };

        // イベントハンドラー
        this.handleMoveBind = this.handleMove.bind(this);
        this.handleMouseUpBind = this.handleMouseUp.bind(this);
        this.animateBind = this.animate.bind(this);
        this.deleteCardBind = this.deleteCard.bind(this);
        this.handleKeyDownBind = this.handleKeyDown.bind(this);

        this.arrangeMode = 'theme';
        this.buttons = [
            { id: 'changeColorSeitou', action: (event) => { this.arrangeMode = "changeColorSeitou"; this.handleButtonClick(event, this.targets.theme);} },
            { id: 'changeColorTsubo', action: (event) => { this.arrangeMode = "changeColorTsubo"; this.handleButtonClick(event, this.targets.theme);} },
            { id: 'map', action: (event) => { this.arrangeMode = "map"; this.handleButtonClick(event, this.targets.map); } },
            { id: 'aiueo', action: (event) => { this.arrangeMode = "aiueo"; this.handleButtonClick(event, this.targets.aiueo); } },
            { id: 'politicalParty', action: (event) => { this.arrangeMode = "politicalParty"; this.handleButtonClick(event, this.targets.politicalParty); } },
        ];

        this.addEventListeners();

        window.addEventListener('resize', this.onWindowResize.bind(this));
        document.addEventListener('contextmenu', function (event) {
            event.preventDefault();
        });

        //ray cast
        window.addEventListener('click', (event) => this.onDocumentMouseClick(event), false);
    }

// detaildisplay を初期化するメソッド (一度だけ呼び出す)
createDetailDisplayObject() {
    // detaildisplay のDOM要素を参照
    this.detailDisplay = document.getElementById('detaildisplay');
    this.detailButtons = Array.from(this.detailDisplay.querySelectorAll('.detail-button'));
    this.textArea = document.getElementById('text-area');
    this.closeButton = document.getElementById('close-button');

    // クローズボタンをクリックしたときの動作
    this.closeButton.addEventListener('click', () => {
        this.hideDetailDisplay();
    });

    // detailButtons のみに適用するクリック動作
    this.detailButtons.forEach((button, index) => {
        button.addEventListener('click', (event) => {
            event.preventDefault(); // デフォルトの動作を止める
            console.log(`Button ${index + 1} clicked`);

            const url = button.href;
            if (url && url !== "#") {
                // 新しいタブでリンク先を開く
                window.open(url, '_blank');
            }
        });
    });

    // 初期化時には表示しない
    this.hideDetailDisplay();
}

    
    // detaildisplay を表示するメソッド
    showDetailDisplay() {
        this.detailDisplay.style.display = 'block'; // 表示
    }
    
    // detaildisplay を非表示にするメソッド
    hideDetailDisplay() {
        this.detailDisplay.style.display = 'none'; // 非表示
    }
    
    // ボタンのhrefを更新するメソッド
    updateDetailButtonLinks(card) {
        let urls = [];

        if (!card) {
            urls = [];
        } else {
            // tuboURLarray はカンマ区切りの文字列または配列で渡されることを想定
            let arr = card.tuboURLarray || [];
            if (typeof arr === 'string') {
                arr = arr.split(',').map(u => u.trim()).filter(u => u);
            } else if (Array.isArray(arr)) {
                arr = arr.map(u => (u || '').trim()).filter(u => u);
            }
            urls = urls.concat(arr);

            if (card.tuboURL && card.tuboURL.trim() !== '') {
                urls.push(card.tuboURL.trim());
            }
            if (card.uraganeURL && card.uraganeURL.trim() !== '') {
                urls.push(card.uraganeURL.trim());
            }
        }

        const maxButtons = this.detailButtons.length; // 10個固定

        while (urls.length < maxButtons) {
            urls.push('');
        }
        if (urls.length > maxButtons) {
            urls = urls.slice(0, maxButtons);
        }

        this.detailButtons.forEach((button, index) => {
            const url = urls[index];
            if (url === '') {
                button.href = '#';
                button.disabled = true;
                button.style.visibility = 'hidden';
            } else {
                button.href = url;
                button.disabled = false;
                button.style.visibility = 'visible';
            }
        });
    }


    // テキストエリアの内容を変更するメソッド
    changeDetailText(text) {
        this.textArea.innerHTML = text;  // テキストエリアにHTMLとして設定
    }

    // 候補者オブジェクトから表示用の詳細テキストを組み立てる
    buildCandidateDetailText(card) {
        if (!card) {
            return '';
        }
        const lines = [];
        if (card.title) lines.push(`氏名：${card.title}`);
        if (card.seitou) lines.push(`政党：${card.seitou}`);
        if (card.age) lines.push(`年齢：${card.age}`);
        if (card.todoufuken) lines.push(`都道府県：${card.todoufuken}`);
        if (card.senkyoku) lines.push(`選挙区：${card.senkyoku}`);
        if (card.detail) lines.push(`詳細：${card.detail}`);
        if (card.tubohantei) lines.push(`壺判定：${card.tubohantei}`);
        if (card.tubonaiyou) lines.push(card.tubonaiyou);
        if (card.uraganehantei) lines.push(`裏金判定：${card.uraganehantei}`);
        if (card.uraganenaiyou) lines.push(card.uraganenaiyou);
        return lines.join('<br />');
    }

    init() {
        // URLからGETパラメータを取得
        const urlParams = new URLSearchParams(window.location.search);
        let keyParam = urlParams.get('key');  // ?key=XXX という形式で取得
    
        document.addEventListener('mousemove', this.handleMoveBind);
        document.addEventListener('mouseup', this.handleMouseUpBind);
        document.addEventListener('keydown', this.handleKeyDownBind);
    
        // 詳細表示のオブジェクトを初期化
        this.createDetailDisplayObject();
        
        // 最初の配置を行う
        this.arangePositions();
        // もしURLにkeyが指定されていれば、そのカードを表示

        if (keyParam && this.cardData.getItem(keyParam)) {
            this.handleKeyParam(keyParam); // 新メソッドの呼び出し
        } else {
            // keyがなければ通常の処理
            this.transform(this.targets.aiueo, 1);
            this.hideAllCards();
        }
    
        // LODの更新とカメラ状態の保存
        this.updateLOD();
        this.camera.saveCameraState(this.controls);
    }
    
    // keyパラメータに基づいてカードを処理するメソッド
    handleKeyParam(keyParam) {
        // URLエンコードされたkeyParamをデコードしてスペースを復元
        keyParam = decodeURIComponent(keyParam);
        const cardsArray = this.cardData.getItem(keyParam)?.childrenInfo?.cards;

        if (cardsArray.length !== 0) {
            console.log(cardsArray);
            // threeObjectsから該当カードを取得
            let cardObject = this.threeObjects[keyParam];

            // 該当カードがない場合は新規作成
            if (!cardObject) {
                console.log(`No threeObject found for cardKey: ${keyParam}. Creating...`);
                this.createCard(keyParam);  // 新しくカードオブジェクトを生成
                cardObject = this.threeObjects[keyParam];  // 再取得
            }
            cardObject.highDetail.visible = true;
            //this.previousKeys.push(keyParam);

            this.animateObjectTransform(cardObject.highDetail, {x: -80, y: 250, z: 200}, {x: 0, y: 0, z: 0}, 2000);
            this.showChildrenCards(cardsArray, 2, 70, 150, -(2 / 2) * 150 + 80, 200);
        } else {
            // threeObjectsから該当カードを取得
            console.log("kite");
            let cardObject = this.threeObjects[keyParam];

            // 該当カードがない場合は新規作成
            if (!cardObject) {
                console.log(`No threeObject found for cardKey: ${keyParam}. Creating...`);
                this.createCard(keyParam);  // 新しくカードオブジェクトを生成
                cardObject = this.threeObjects[keyParam];  // 再取得
            }
            cardObject.highDetail.visible = true;
            //this.previousKeys.push(keyParam);
            this.animateObjectTransform(cardObject.highDetail, {x: 0, y: 200, z: 230}, {x: 0, y: 0, z: 0}, 2000);

            const info = this.cardData.items[keyParam];
            this.updateDetailButtonLinks(info);
            this.changeDetailText(this.buildCandidateDetailText(info));
            this.showDetailDisplay();
        }
    }


    animate(time) {
        requestAnimationFrame(this.animateBind);
        this.cardTweenGroup.update(time);
        TWEEN.update(time);
        this.controls.update();
        this.render();
    }

    render() {
        this.renderer.render(this.scene, this.camera);  // WebGLRendererを使用
    }
    

    // カメラのz座標に基づいて詳細レベルを切り替える
    updateLOD() {
        return false;
        for (let key in this.threeObjects) {
            const lodSet = this.threeObjects[key]; // lowDetail, mediumDetail, highDetail のセット
            const objectPositionZ = lodSet.highDetail.position.z; // highDetail のZ座標を使用
            const cameraPositionZ = this.camera.position.z;
    
            // カメラとオブジェクト間のZ軸距離を計算
            const distanceZ = cameraPositionZ - objectPositionZ;
    
            // オブジェクトがカメラの背後にある場合
            if (distanceZ < 500) {
                this.switchDetail(lodSet, 'none');
            } else if (distanceZ < 2500) {
                this.switchDetail(lodSet, 'highDetail');
            } else if (distanceZ < 10000) {
                this.switchDetail(lodSet, 'mediumDetail');
            } else {
                this.switchDetail(lodSet, 'lowDetail');
            }
        }
    }

    // あるLODセットの中で指定された詳細レベルのオブジェクトだけを表示
    switchDetail(lodSet, detailLevel) {
        for (let level in lodSet) {
            // 'none' が指定された場合、すべてのオブジェクトを非表示
            if (detailLevel === 'none') {
                lodSet[level].visible = false;
            } else {
                // 指定された詳細レベルのみ表示
                lodSet[level].visible = (level === detailLevel);
            }
        }
    }

    // 日本地図をSVGとして読み込み、シーンに追加
    loadJapanMap() {
        const loader = new SVGLoader();
        const svgPath = './svg/map-mobile.svg';  // SVGフォルダ内に保存した日本地図のパス
        const scaleFactor = 10000;  // 位置と回転のランダム範囲を制御するスケーリング変数
    
        loader.load(svgPath, (data) => {
            const paths = data.paths;
            const group = new THREE.Group();
    
            let svgCounter = 0;  // 通し番号用のカウンタ
    
            paths.forEach((path) => {
                const material = new THREE.MeshBasicMaterial({
                    color: 0x0A0A0A,
                    opacity: 0.5,
                    side: THREE.DoubleSide,
                    depthWrite: false,
                });
    
                const shapes = SVGLoader.createShapes(path);
                shapes.forEach((shape) => {
                    const geometry = new THREE.ShapeGeometry(shape);
                    const mesh = new THREE.Mesh(geometry, material);
    
                    // 枠線（境界線）を追加
                    const edges = new THREE.EdgesGeometry(geometry);
                    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xb0c4de });  // 枠線の色を指定
                    const line = new THREE.LineSegments(edges, lineMaterial);
    
                    // メッシュと枠線を一緒にグループ化
                    const meshGroup = new THREE.Group();
                    meshGroup.add(mesh);  // メッシュをグループに追加
                    meshGroup.add(line);  // 枠線をグループに追加
                    group.add(meshGroup);  // メッシュと枠線のグループをシーンに追加
    
                    // 通し番号を生成
                    const uniqueId = `svg-${svgCounter++}`;
                    meshGroup.userData.prefecture = uniqueId;
    
                    // 県名（title）を安全に取得
                    let title = 'Unknown';  // デフォルト値として'Unknown'を設定
                    try {
                        const titleElement = path.userData.node.parentNode.querySelector('title');
                        if (titleElement) {
                            title = titleElement.textContent;
                        }
                    } catch (error) {
                        console.warn(`Could not retrieve title for ${uniqueId}:`, error);
                    }
    
                    // 県名とIDを保存
                    this.prefectureData[uniqueId] = title;
    
                    // mapObjectsに通し番号を使って保存
                    this.mapObjects[uniqueId] = meshGroup;
    
                    // 位置と回転をランダムに設定
                    meshGroup.position.set(
                        (Math.random() - 0.5) * scaleFactor,  // x座標をランダムに
                        (Math.random() - 0.5) * scaleFactor,  // y座標をランダムに
                        (Math.random() - 0.5) * scaleFactor   // z座標をランダムに
                    );
    
                    // 回転をランダムに設定
                    meshGroup.rotation.set(
                        Math.random() * Math.PI,  // x軸回りの回転をランダムに
                        Math.random() * Math.PI,  // y軸回りの回転をランダムに
                        Math.random() * Math.PI   // z軸回りの回転をランダムに
                    );
                });
            });
    
            group.scale.multiplyScalar(0.35); // SVGのスケールを調整
            this.scene.add(group);
    
            // すべてのメッシュが追加された後にmoveAllPrefecturesToPositionを呼び出す
            this.moveAllPrefecturesToPosition();
        });
    }

//memo
    onDocumentMouseClick(event) {
        //event.preventDefault();
    
        // マウス座標を正規化
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
        // カメラとマウスの方向からRayを設定
        this.raycaster.setFromCamera(this.mouse, this.camera);
    
        // this.mapObjectsとthis.threeObjectsのオブジェクトを一つの配列に結合
        const mapObjectsArray = Object.values(this.mapObjects);
        const threeObjectsArray = Object.values(this.threeObjects).map(lodSet => lodSet.highDetail); // LODのhighDetailのみを対象とする場合
        const wakuObjectArray = Object.values(this.waku);
        const combinedObjects = [...mapObjectsArray, ...threeObjectsArray, ...wakuObjectArray];
    
        // シーン内のオブジェクトをRayで交差判定
        const intersects = this.raycaster.intersectObjects(combinedObjects, true);
console.log(intersects);
        if (intersects.length > 0) {
            let isProcessed = false;  // 処理完了フラグ

            for (let i = 0; i < intersects.length; i++) {
                const intersectedObject = intersects[i].object;  // 順次オブジェクトを取得

                // mapObjectsの処理（県オブジェクトの場合）
                if (intersectedObject.parent && intersectedObject.parent.userData.prefecture) {
                    // すべての県の色を初期化
                    Object.values(this.mapObjects).forEach((meshGroup) => {
                        meshGroup.children[0].material.color.set(0x696969);  // メッシュの最初の子要素の色を初期化
                        meshGroup.children[1].material.color.set(0xb0c4de);  // メッシュの枠線の色を初期化
                    });

                    const prefectureId = intersectedObject.parent.userData.prefecture;
                    const prefectureName = this.prefectureData[prefectureId];

                    // クリックされた県の色を赤に変更
                    this.pickUpPrefecture(prefectureId, prefectureName);
                    this.selectedPrefecture = prefectureName;
                    isProcessed = true;  // フラグを立てる
                    break;  // ループを抜ける
                }

                // threeObjectsの処理（カードオブジェクトの場合）
                if (intersectedObject.userData && intersectedObject.userData.cardId) {
                    const cardId = intersectedObject.userData.cardId;
                    console.log(this.cardData.getItem(cardId));

                    // 選挙区カードを押したとき
                    if (cardId.endsWith('区')) {
                        this.animateObjectTransform(intersectedObject, { x: -80, y: 250, z: 90 }, { x: 0, y: 0, z: 0 }, 2000);
                        this.hideAllWaku(intersectedObject);
                        this.hideAllCards(cardId);
                        this.previousKeys.push(cardId);
                        this.showChildrenCards(this.cardData.items[cardId].childrenInfo.cards);
                        isProcessed = true;  // フラグを立てる
                        break;  // ループを抜ける
                    }

                    // あいうえおカードを押したとき
                    else if (cardId.length == 1) {
                        this.animateObjectTransform(intersectedObject, { x: -80, y: 250, z: 90 }, { x: 0, y: 0, z: 0 }, 2000);
                        this.hideAllWaku();
                        this.hideAllCards(cardId);
                        this.previousKeys.push(cardId);
                        this.showChildrenCards(this.cardData.items[cardId].childrenInfo.cards);
                        isProcessed = true;  // フラグを立てる
                        break;  // ループを抜ける
                    }

                    // 議員カードを押したとき
                    else {
                        console.log("uraganeok");
                        this.camera.moveToOrigin(this.controls);
                        this.animateObjectTransform(intersectedObject, { x: 0, y: 200, z: 230 }, { x: 0, y: 0, z: 0 }, 2000);
                        this.previousKeys.push(cardId);
                        this.hideAllWaku();
                        this.hideAllCards(cardId);
                        const cardInfo = this.cardData.items[cardId];
                        this.updateDetailButtonLinks(cardInfo);
                        this.changeDetailText(this.buildCandidateDetailText(cardInfo));
                        this.showDetailDisplay();
                        isProcessed = true;  // フラグを立てる
                        break;  // ループを抜ける
                    }
                }

                // wakuの処理（wakuオブジェクトの場合）
                if (intersectedObject.userData.wakuKey) {
                    this.selectWaku(intersectedObject.userData);
                    isProcessed = true;  // フラグを立てる
                    break;  // ループを抜ける
                }
            }

            // 処理が完了した場合のログ（デバッグ用）
            if (isProcessed) {
                console.log("処理が完了しました");
            }
        } else {
            // 何もクリックされなかった場合の処理
            console.log("空間をクリックしました。");
        }
    }




    // Prefecture animation (変更なし)
    pickUpPrefecture(prefectureId, prefectureName, duration = 2000) {
        //console.log(prefectureName);
        const targetColor = new THREE.Color(211/255, 211/255, 211/255);

        const mesh = this.mapObjects[prefectureId];

        for (const pId in this.mapObjects) {
            if (this.mapObjects.hasOwnProperty(pId)) {
                //console.log(pId);
                //console.log(prefectureId);
                if(pId == prefectureId){
                    // TODO: Use prefecture name for mesh lookup when handling islands
                    //pickされたもの
                    // 色のアニメーション
                    
                    new TWEEN.Tween(mesh.children[0].material.color)
                        .to({ r: 176/255, g: 196/255, b: 222/255 ,a: 0.5}, duration)
                        .easing(TWEEN.Easing.Exponential.InOut)
                        .start();

                    new TWEEN.Tween(mesh.children[1].material.color)
                        .to({ r: 0/255, g: 255/255, b: 255/255 ,a: 0.5}, duration)
                        .easing(TWEEN.Easing.Exponential.InOut)
                        .start();
                
                    // 座標のイージング移動
                    
                    new TWEEN.Tween(mesh.position)
                        .to({ x: -500, y:400, z: 200 }, duration)
                        .easing(TWEEN.Easing.Exponential.InOut)
                        .start();

                    //関連するUI表示
                    this.showWakuShousenkyokuOrHirei();
                }else{
                    //それ以外は初期位置と色に戻す
                    this.movePrefectureToPosition(pId);
                }
            }
        }
    }

    movePrefectureToPosition(prefectureId, targetX = -500, targetY = 400, targetZ = 100, duration = 3000) {
        const mesh = this.mapObjects[prefectureId];
    
        if (!mesh) {
            console.error(`Prefecture ${prefectureId} not found.`);
            return;
        }
    
        // メッシュと枠線を再度表示
        mesh.children.forEach((child) => {
            child.visible = true; // 再表示
            new TWEEN.Tween(child.material)
                .to({ opacity: 1 }, duration)  // 透明度を元に戻す
                .easing(TWEEN.Easing.Exponential.InOut)
                .onStart(() => {
                    child.material.transparent = true;  // 透明度を有効に
                })
                .start();
        });
    
        // 色のアニメーション
        new TWEEN.Tween(mesh.children[0].material.color)
            .to({ r: 10 / 255, g: 10 / 255, b: 10 / 255 }, duration)
            .easing(TWEEN.Easing.Exponential.InOut)
            .start();
    
        new TWEEN.Tween(mesh.children[1].material.color)
            .to({ r: 176 / 255, g: 196 / 255, b: 222 / 255 }, duration)
            .easing(TWEEN.Easing.Exponential.InOut)
            .start();
    
        // 座標のイージング移動
        new TWEEN.Tween(mesh.position)
            .to({ x: targetX, y: targetY, z: targetZ }, duration)
            .easing(TWEEN.Easing.Exponential.InOut)
            .start();
    
        // 回転をリセットする
        new TWEEN.Tween(mesh.rotation)
            .to({ x: 3.14, y: 0, z: 0 }, duration)  // 回転を全て0にリセット
            .easing(TWEEN.Easing.Exponential.InOut)
            .start();
    }
    
    
    

    // 全ての県を一括で移動させるメソッド
    moveAllPrefecturesToPosition() {
        TWEEN.removeAll();
        for (const prefectureId in this.mapObjects) {
            if (this.mapObjects.hasOwnProperty(prefectureId)) {
                this.movePrefectureToPosition(prefectureId);
            }
        }
    }
    
    randomizePrefecturePositions(duration = 3000) {
        TWEEN.removeAll();
        for (const prefectureId in this.mapObjects) {
            if (this.mapObjects.hasOwnProperty(prefectureId)) {
                const mesh = this.mapObjects[prefectureId];
    
                // ランダムな位置と回転を生成
                const randomPosition = {
                    x: (Math.random() - 0.5) * 2000,
                    y: (Math.random() - 0.5) * 2000,
                    z: (Math.random() - 0.5) * 2000 -(2000)
                };
    
                const randomRotation = {
                    x: Math.random() * Math.PI * 2,
                    y: Math.random() * Math.PI * 2,
                    z: Math.random() * Math.PI * 2
                };
    
                // ランダムな位置に移動
                new TWEEN.Tween(mesh.position)
                    .to({ x: randomPosition.x, y: randomPosition.y, z: randomPosition.z }, duration)
                    .easing(TWEEN.Easing.Exponential.InOut)
                    .start();
    
                // ランダムな回転を設定
                new TWEEN.Tween(mesh.rotation)
                    .to({ x: randomRotation.x, y: randomRotation.y, z: randomRotation.z }, duration)
                    .easing(TWEEN.Easing.Exponential.InOut)
                    .start();
    
                // 透明度を0にするアニメーション（メッシュ本体の透明度）
                mesh.children.forEach((child) => {
                    new TWEEN.Tween(child.material)
                        .to({ opacity: 0 }, duration)
                        .easing(TWEEN.Easing.Exponential.InOut)
                        .onStart(() => {
                            child.material.transparent = true;  // 透明度を有効にする
                        })
                        .onComplete(() => {
                            child.visible = false;  // 完全に透明になったら非表示にする
                        })
                        .start();
                });
    
                // 枠線の透明度を変更（枠線がLineSegmentsである場合）
                if (mesh.children.length > 1 && mesh.children[1].material instanceof THREE.LineBasicMaterial) {
                    new TWEEN.Tween(mesh.children[1].material)
                        .to({ opacity: 0 }, duration)
                        .easing(TWEEN.Easing.Exponential.InOut)
                        .onStart(() => {
                            mesh.children[1].material.transparent = true;  // 枠線の透明度を有効にする
                        })
                        .onComplete(() => {
                            mesh.children[1].visible = false;  // 完全に透明になったら非表示にする
                        })
                        .start();
                }
            }
        }
    }
    
    

    handleButtonClick(event, transformTarget) {
        // イベントの伝播を停止
        event.stopPropagation();
        if(this.arrangeMode == "changeColorSeitou"){
            Object.keys(this.cardData.items).forEach((key) => {
                const card = this.cardData.items[key];
                if(!card) return;
                const partyColor = this.getPartyColor(card.seitou);
                if(partyColor){
                    this.animateColorChange(key, partyColor, 2000);
                    if(card.color){
                        card.color.politicalParty = partyColor;
                    }
                }
            });
        }else if(this.arrangeMode == "changeColorTsubo"){ 
            Object.keys(this.cardData.items).forEach((key) => {
                const card = this.cardData.items[key];
                if(!card) return;
                const issueColor = this.getIssueColor(card);
                if(issueColor){
                    this.animateColorChange(key, issueColor, 2000);
                }
            });
        }



        if(this.arrangeMode == "map"){
            this.camera.moveToOrigin(this.controls);
            this.hideDetailDisplay();
            this.hideAllWaku();
            clearTimeout(this.hideCardsTimeout);
            this.hideCardsTimeout = setTimeout(() => {this.hideAllCards();}, 2050);
            this.moveAllPrefecturesToPosition();
            this.transform(transformTarget, 2000, false);
        }else if(this.arrangeMode == "politicalParty"){
            this.camera.moveToOrigin(this.controls);
            this.hideDetailDisplay();
            this.hideAllWaku();
            clearTimeout(this.hideCardsTimeout);
            this.hideCardsTimeout = setTimeout(() => {this.hideAllCards();}, 2050);
            this.randomizePrefecturePositions();
            this.showPartyWaku();
            this.transform(transformTarget, 2000, false);
        }else if(this.arrangeMode == "aiueo"){
            this.camera.moveToOrigin(this.controls);
            this.hideDetailDisplay();
            this.hideAllWaku();
            this.randomizePrefecturePositions();
            this.showAiueoWaku();
            this.transform(transformTarget, 2000, true);
        }else if(this.arrangeMode == "theme"){
            this.hideAllWaku();
            this.randomizePrefecturePositions();
            this.transform(transformTarget, 2000, true);
        }
        //this.releaseAnchorCard();

    }

    addEventListeners() {
        // ボタンにイベントハンドラを一括で追加
        this.buttons.forEach(button => {
            const element = document.getElementById(button.id);
            if (element) {
                element.addEventListener('click', button.action);
            }
        });
    
        // Raycaster と mouse ベクトルをクラスのプロパティとして初期化
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
    
        // マウスダウン時のイベントリスナー
        this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    
        // マウスアップ時のイベントリスナー
        this.renderer.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
    }
    
    // マウスダウンイベント時の処理
    onMouseDown(event) {
        // マウス座標を正規化
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // Raycasterを使ってシーン内のオブジェクトと交差判定
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        if (intersects.length > 0) {
            const intersected = intersects[0].object;
            if (intersected.userData && intersected.userData.onMouseDown) {
                intersected.userData.onMouseDown(event);
            }
        }
    }

    // マウスアップイベント時の処理
    onMouseUp(event) {
        // マウス座標を正規化
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // Raycasterを使ってシーン内のオブジェクトと交差判定
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        if (intersects.length > 0) {
            const intersected = intersects[0].object;
            if (intersected.userData && intersected.userData.onMouseUp) {
                intersected.userData.onMouseUp(event);
            }
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.render();
    }

    // カードの色を変更するメソッド
    changeCardColor(key, color) {
        const lodSet = this.threeObjects[key];
        if (!lodSet) {
            console.error(`カードキー "${key}" が見つかりません。`);
            return;
        }

        // 各詳細レベルの要素の背景色を変更
        for (let level in lodSet) {
            const element = lodSet[level].element;
            if (element) {
                element.style.backgroundColor = color;
            }
        }

        // cardData の色情報を更新
        const cardItem = this.cardData.getItem(key);
        if (!cardItem) {
            console.error(`cardData 内にカードキー "${key}" が存在しません。`);
            return;
        }

        if (this.arrangeMode === "theme") {
            cardItem.color.theme = color;
        } else if (this.arrangeMode === "map") {
            cardItem.color.map = color;
        } else if (this.arrangeMode === "aiueo") {
            cardItem.color.aiueo = color;
        } else if (this.arrangeMode === "politicalParty") {
            cardItem.color.politicalParty = color;
        } else {
            // arrangeMode が特別な4つ以外の場合の処理
            const parentCardId = this.arrangeMode;
            const parentCard = this.cardData.getItem(parentCardId);
            if (parentCard) {
                if (!parentCard.childrenInfo) {
                    parentCard.childrenInfo = { camera: null, cards: {} };
                }
                if (!parentCard.childrenInfo.cards) {
                    parentCard.childrenInfo.cards = {};
                }
                if (!parentCard.childrenInfo.cards[key]) {
                    parentCard.childrenInfo.cards[key] = {};
                }
                parentCard.childrenInfo.cards[key].color = color;
            } else {
                console.warn(`Parent card with ID "${parentCardId}" not found.`);
            }
        }

        // データを保存
        this.cardData.saveLocalStorage();
    }

    changeImg(key, img) {
        // cardData の情報を更新
        const cardItem = this.cardData.getItem(key);
        if (!cardItem) {
            console.error(`cardData 内にカードキー "${key}" が存在しません。`);
            return;
        }

        cardItem.img = img;

        // データを保存
        this.cardData.saveLocalStorage();
    }

    changeVideo(key, video) {
        // cardData の情報を更新
        const cardItem = this.cardData.getItem(key);
        if (!cardItem) {
            console.error(`cardData 内にカードキー "${key}" が存在しません。`);
            return;
        }

        cardItem.video = video;

        // データを保存
        this.cardData.saveLocalStorage();
    }

    changeType(key, type) {
        // cardData の情報を更新
        const cardItem = this.cardData.getItem(key);
        if (!cardItem) {
            console.error(`cardData 内にカードキー "${key}" が存在しません。`);
            return;
        }

        cardItem.type = type;

        // データを保存
        this.cardData.saveLocalStorage();
    }

    showModalEditor(cardKey) {
        const cardItem = this.cardData.getItem(cardKey);
        if (!cardItem) {
            console.error(`cardData 内にカードキー "${cardKey}" が存在しません。`);
            return;
        }

        const lodSet = this.threeObjects[cardKey];
        if (!lodSet) {
            console.error(`カードキー "${cardKey}" が見つかりません。`);
            return;
        }
        
        this.currentSelectedCardKey = cardKey;
        this.ModalEditor.openModal(lodSet['lowDetail'].element.style.backgroundColor, cardItem.img, cardItem.video, cardItem.type);
    }

    arrangeCardByChildrenInfo(cardId){    
        
        // カードデータから childrenInfo を取得
        const card = this.cardData.getItem(cardId);
        const childrenInfo = card.childrenInfo;
        // childrenInfo が null であれば処理をせずに抜ける
        if (!childrenInfo) {
            return;
        } else {
            // childrenInfo が存在する場合、処理を行う
            // this.arrangeMode をクリックされた CSS3Object の cardId に書き換える
            this.arrangeMode = cardId;
    
            // カメラを移動
            if (childrenInfo.camera) {
                const positionXYZ = childrenInfo.camera;
                const targetXYZ = childrenInfo.cameraTarget || this.controls.target;

                // コントロールを無効化
                this.controls.enabled = false;

                // カメラを移動
                this.camera.moveCamera(positionXYZ, targetXYZ, 2000, this.controls);

                // カメラのアニメーション終了後にコントロールを有効化
                setTimeout(() => {
                    this.controls.enabled = true;
                }, 2100);
            } else {
                console.log("カメラ情報がありません");
            }
            // childrenInfo.cards に含まれるカードを移動  色も変更する
            if (childrenInfo.cards) {
                this.transformSelectedCards(childrenInfo.cards, 2000);
            }
        }        
    }
    

    setAnchorCard(key){
        this.targetSetSession = true;
        this.releaseAnchorCard();
        this.arrangeMode = key;
        this.threeObjects[key].highDetail.element.classList.add('highlight');
        this.threeObjects[key].mediumDetail.element.classList.add('highlight');
        this.threeObjects[key].lowDetail.element.classList.add('highlight');
        this.anchorCard = this.threeObjects[key];
    }

    releaseAnchorCard(){
        if(this.anchorCard){
            this.anchorCard.highDetail.element.classList.remove('highlight');
            this.anchorCard.mediumDetail.element.classList.remove('highlight');
            this.anchorCard.lowDetail.element.classList.remove('highlight');
            this.anchorCard = null;
        }
    }

    handleStart(e) {
        //例外処理↓

        // カメラに対して対象objectが十分近いときにデフォルトのDOM操作を妨げない
        const clickedObject = e.currentTarget.objectCSS;
        const objectPositionZ = clickedObject.position.z;
        const cameraPositionZ = this.camera.position.z;
        const distanceZ = Math.abs(cameraPositionZ - objectPositionZ);
        if (distanceZ <= 2000) {
            if (this.giinDB){
                if (e.button === 0) {
                    // 左クリック時の処理
                    this.arrangeCardByChildrenInfo(e.target.cardId);
                } else if (e.button === 2) {
                    // 右クリック時の処理
                    this.setAnchorCard(e.target.cardId);
                }
                return;
            } else {
                return;
            }
        } else {
            if (this.giinDB && e.button === 2){
                // 右クリック時にカラーピッカーを開く前に現在のカードキーを設定
                this.showModalEditor(e.target.cardId);
                return;
            }            
        }

        //Xボタンを押した後キャンセルしたときの挙動のため。でもまだ不完全
        if (e.target.classList.contains('number')) {
            // デフォルトの動作をキャンセルし、イベントの伝播を停止
            e.preventDefault();
            e.stopPropagation();
            //dragが抑制できているはずだが、何もない空間でのpanが動いてしまっている。
            //this.control.enable = falseと カメラの保存 そして復帰をしなければいけないとはおもう
            return;
        }
        //例外処理↑
        
        const isTouchEvent = e.type.startsWith('touch');
        const clientX = isTouchEvent ? e.touches[0].clientX : e.clientX;
        const clientY = isTouchEvent ? e.touches[0].clientY : e.clientY;

        this.mouse = new THREE.Vector2();
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        // 初期マウス位置を保存
        this.initialMouse = this.mouse.clone();
        this.IsHandleStart = true;
        // イベントターゲットから selectedObject draggedObject を取得
        this.selectedObject = e.currentTarget.objectCSS;
        const lodSet = this.threeObjects[e.currentTarget.cardId];
        if (lodSet) {
            this.draggedObject = lodSet;
        } else {
            console.log('LOD set not found for cardId:', e.currentTarget.cardId);
        }

        // コントロールを無効化
        this.controls.enabled = false;
        this.camera.saveCameraState(this.controls);
    }

    handleMove(e) {
        this.cameraMoving = true;
        if (!this.IsHandleStart && !this.isDragging) return;
        //drag開始処理
        if(this.IsHandleStart){
            this.IsHandleStart = false;

            if (this.selectedObject) {
                // オブジェクトのワールド座標を取得
                this.initialObjectPosition = this.selectedObject.position.clone();

                // オブジェクトのカメラ空間での深度を取得
                const vector = this.initialObjectPosition.clone();
                vector.project(this.camera);
                this.objectDepth = vector.z;
                this.isDragging = true;            
                
            } else {
                console.log('Selected object not found from event target');
            }
        }

        //drag処理
        //e.preventDefault();
        //e.stopPropagation(); // イベントの伝播を防止

        const isTouchEvent = e.type.startsWith('touch');
        let clientX, clientY;

        if (isTouchEvent) {
            if (e.touches.length !== 1) return; // シングルタッチのみ処理
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        // 新しいマウス位置からワールド座標を計算
        const vector = new THREE.Vector3(this.mouse.x, this.mouse.y, this.objectDepth);
        vector.unproject(this.camera);

        // オブジェクトの新しい位置を計算
        const deltaPosition = vector.clone().sub(this.initialObjectPosition);

        this.selectedObject.position.copy(this.initialObjectPosition).add(deltaPosition);

        // 対応するLODレベルのオブジェクトも更新
        const key = this.selectedObject.cardId;
        const lodSet = this.threeObjects[key];
        for (let level in lodSet) {
            if (lodSet[level] !== this.selectedObject) {
                lodSet[level].position.copy(this.selectedObject.position);
            }
        }

        // カードデータの位置を更新
        if(this.arrangeMode === "theme"){
            this.cardData.getItem(key).position.theme.x = this.selectedObject.position.x;
            this.cardData.getItem(key).position.theme.y = this.selectedObject.position.y;
        }else if(this.arrangeMode === "map"){
            this.cardData.getItem(key).position.map.x = this.selectedObject.position.x;
            this.cardData.getItem(key).position.map.y = this.selectedObject.position.y;
        }else if(this.arrangeMode === "aiueo"){
            this.cardData.getItem(key).position.aiueo.x = this.selectedObject.position.x;
            this.cardData.getItem(key).position.aiueo.y = this.selectedObject.position.y;
        }else if(this.arrangeMode === "politicalParty"){
            this.cardData.getItem(key).position.politicalParty.x = this.selectedObject.position.x;
            this.cardData.getItem(key).position.politicalParty.y = this.selectedObject.position.y;
        }else if(this.anchorCard){
            
            // arrangeMode が特別な4つ以外の場合の処理
            const parentCardId = this.arrangeMode;
            const parentCard = this.cardData.getItem(parentCardId);
            if (parentCard) {
                if (!parentCard.childrenInfo) {
                    parentCard.childrenInfo = { camera: null, cards: {} };
                }
                if (!parentCard.childrenInfo.cards) {
                    parentCard.childrenInfo.cards = {};
                }
                // 現在ドラッグしているカードの位置情報を保存
                parentCard.childrenInfo.cards[key] = {
                    position: {
                        x: this.selectedObject.position.x,
                        y: this.selectedObject.position.y,
                        z: this.selectedObject.position.z
                    }
                    // 必要に応じて他の情報（rotationやcolorなど）も追加できます
                };
            } else {
                console.warn(`Parent card with ID ${parentCardId} not found.`);
            }
        }

        this.render();
    }

    handleMouseUp(e) {
        //e.preventDefault();
        //e.stopPropagation(); // イベントの伝播を防止

        if(!this.selectedObject && !this.isDragging) {
            //このif文の理由としては、ターゲットをセットしたそのクリックでmouseupが発生してしまい、すぐに解除されちゃうから。
            //一回だけキャンセルしないといけないという微妙なはなしで。でも変更箇所をすくなくしたいから。targetSetSessionっていうフラグをこれだけに使って一度だけキャンセルしている
            if(!this.targetSetSession && !this.cameraMoving){
                this.releaseAnchorCard();
            }else{
                this.targetSetSession = false;
            }
        }

        if (this.IsHandleStart && !this.isDragging) {
            if (this.draggedObject) {
                this.camera.moveCameraNormalToCSSobj(this.draggedObject.highDetail, this.controls);
            } else {
                console.log('Target object not found for cardId:', cardId);
            }
        }

        this.handleEnd(e);
    }

    handleEnd(e) {
        if(this.selectedObject){
            //controlsをdisableにしていても裏で動いている。だから最初の地点にカメラを戻す。
            this.controls.reset();
            this.camera.returnToSavedState(1, this.controls);    
        }

        this.controls.enabled = true;
        this.isDragging = false;
        this.draggedObject = null;
        this.selectedObject = null;
        this.IsHandleStart = false;
        this.arangePositions();
        this.cardData.saveLocalStorage();
        this.cameraMoving = false;
    }

    getMouseOrTouchPointXY(e) {
        let currentX, currentY;

        if (e.type.startsWith('touch')) {
            currentX = e.touches[0].pageX;
            currentY = e.touches[0].pageY;
        } else {
            currentX = e.clientX;
            currentY = e.clientY;
        }
        return { x: currentX, y: currentY };
    }

    //キー操作関連
    // キーが押されたときの処理
    handleKeyDown(event) {
        switch(event.key) {
            case 'ArrowUp':
                this.arrowUp();
                break;
            case 'ArrowDown':
                this.arrowDown();
                break;
            case 'ArrowRight':
                this.arrowRight();
                break;
            default:
                // 他のキーが押された場合の処理（必要に応じて）
                break;
        }
    }

    // 上矢印キーが押されたときのメソッド
    arrowUp() {
        console.log('上矢印キーが押されました');
        this.moveCardZ(100);
    }

    // 下矢印キーが押されたときのメソッド
    arrowDown() {
        console.log('下矢印キーが押されました');
        this.moveCardZ(-100);
    }

    // 右矢印キーが押されたときのメソッド
    arrowRight() {
        console.log("save camera position");
        this.saveCurrentCameraPosition();
    }

    moveCardZ(deltaZ){
        if (!this.selectedObject) {
            console.log('No object selected to move.');
            return;
        }

        // 選択されたオブジェクトの Z 座標を更新
        this.selectedObject.position.z += deltaZ;

        // 対応する LOD レベルのオブジェクトも更新
        const key = this.selectedObject.cardId;
        const lodSet = this.threeObjects[key];
        for (let level in lodSet) {
            if (lodSet[level] !== this.selectedObject) {
                lodSet[level].position.z = this.selectedObject.position.z;
            }
        }

        // カードデータの位置を更新
        if(this.arrangeMode === "theme"){
            this.cardData.getItem(key).position.theme.z = this.selectedObject.position.z;
        }else if(this.arrangeMode === "map"){
            this.cardData.getItem(key).position.map.z = this.selectedObject.position.z;
        }else if(this.arrangeMode === "aiueo"){
            this.cardData.getItem(key).position.aiueo.z = this.selectedObject.position.z;
        }else if(this.arrangeMode === "politicalParty"){
            this.cardData.getItem(key).position.politicalParty.z = this.selectedObject.position.z;
        }

        // 再描画
        this.render();
    }

    saveCurrentCameraPosition() {
        const parentCardId = this.arrangeMode;
        const parentCard = this.cardData.getItem(parentCardId);
    
        if (parentCard) {
            if (!parentCard.childrenInfo) {
                parentCard.childrenInfo = { camera: null, cameraTarget: null, cards: {} };
            }
    
            // 現在のカメラ座標とターゲット位置を保存
            parentCard.childrenInfo.camera = {
                x: this.camera.position.x,
                y: this.camera.position.y,
                z: this.camera.position.z
            };
    
            parentCard.childrenInfo.cameraTarget = {
                x: this.controls.target.x,
                y: this.controls.target.y,
                z: this.controls.target.z
            };
        } else {
            console.warn(`Parent card with ID ${parentCardId} not found.`);
        }
    }

    //Card追加、削除など
    deleteCard(e) {
        const cardId = e.target.cardId;
        const card = this.cardData.getItem(cardId);

        if (card) {
            //e.stopPropagation();
            //e.preventDefault();
            let userResponse = confirm("Are you sure you want to delete?");
            if (userResponse) {
                // cardDataで削除
                this.cardData.deleteItem(cardId);

                // CSS3Dオブジェクトも削除
                const draggedObject = this.threeObjects.find(obj => obj.cardId === cardId);
                if (draggedObject) {
                    this.scene.remove(draggedObject);
                    this.threeObjects = this.threeObjects.filter(obj => obj.cardId !== cardId); // cssObjectsからも削除
                }

                // arangePositionsや再レンダリングが必要であれば呼び出し
                this.arangePositions();

                // 画面の再読み込み
                location.reload();
            }
            this.handleEnd(e);
        }
    }


    createWaku() {
        const labels = {
            shousenkyoku: "選挙区",
            hireiku: "比例区",
            zimin: "自由民主党",
            koumei: "公明党",
            rikken: "立憲民主党",            
            ishin: "日本維新の会",
            kyousan: "日本共産党",                        
            kokumin: "国民民主党",
            reiwa: "れいわ新選組",
            shamin: "社会民主党",
            sansei: "参政党",
            nippo: "日保",
            mintsuku: "みんつく",
            nkoku: "N国",
            saidou: "再道",
            mirai: "みらい",
            nikai: "日改",
            nissei: "日本誠真会",
            nichiie: "日本の家庭を守る会",
            yamato: "新党やまと",
            sabetsu: "差別撲滅党#平和フリーズ",
            kakuyu: "核融合党",
            genzei: "減税日本",
            kunimori: "新党くにもり",
            tafu: "多夫多妻党",
            kokuga: "国政ガバナンスの会",
            shinsha: "新社会党",
            mushozoku: "無所属",
            shoha: "諸派",
            fumei: "不明",
            a: "あ",
            ka: "か",
            sa: "さ",
            ta: "た",
            na: "な",
            ha: "は",
            ma: "ま",
            ya: "や",
            ra: "ら",
            wa: "わ",
        };
    
        const colorArray = PARTY_COLOR_MAP;


        for (const key in labels) {  // `const`で宣言する
            let strColor = "#000000";
            try {strColor = colorArray[key];}catch{}
            if(strColor !== "#000000" ){
                this.waku[key] = this.createWakuMesh(key, labels[key], strColor);  // `this`を使ってメソッドを呼び出す
            }else{
                this.waku[key] = this.createWakuMesh(key, labels[key]);  // `this`を使ってメソッドを呼び出す
            }

            this.waku[key].visible = false;
            this.scene.add(this.waku[key]);
        }
    }

    addPrefectureSuffix(input) {
        // JSON データには都道府県名の表記揺れがあるため
        // 既存キーを優先的に返し、なければ候補を試す
        if (this.cardData.getItem(input)) {
            return input;
        }

        const special = {
            "北海道": "北海道",
            "東京": "東京都",
            "大阪": "大阪府",
            "京都": "京都府",
            // 合区となっている都道府県のマッピング
            "鳥取": "鳥取・島根県",
            "島根": "鳥取・島根県",
            "徳島": "徳島・高知県",
            "高知": "徳島・高知県"
        };

        if (special[input] && this.cardData.getItem(special[input])) {
            return special[input];
        }

        const withKen = input + "県";
        if (this.cardData.getItem(withKen)) {
            return withKen;
        }

        return input;
    }

    getPartyColor(name) {
        const key = this.partyKeyMap[name] || name;
        return this.partyColorMap[key];
    }

    // Determine highlight color based on tsubo/uragane information
    getIssueColor(card) {
        if (!card) return null;
        const hasTubo = card.tubohantei && card.tubohantei !== "";
        const hasUragane = card.uraganehantei && card.uraganehantei !== "";
        if (hasTubo && hasUragane) return BOTH_COLOR;
        if (hasUragane) return URAGANE_COLOR;
        if (hasTubo) return TUBO_COLOR;
        return NO_ISSUE_COLOR;
    }
    

    selectWaku(userData) {
        // 既存の処理
        this.transformWaku(userData, -80, 250, 180);
        this.hideAllWaku(userData.wakuKey);
        // 新しく追加する処理
        const aiueoKeys = this.castAIUOEIDtoCardDataKey(userData.wakuKey);
        if (userData.wakuKey === 'shousenkyoku') {
            // スペースでスプリットし、最初の要素を使う
            const prefectureKey = this.addPrefectureSuffix(this.selectedPrefecture.split(' ')[0]);
    
            // cardData.itemsから直接childrenInfo.cardsを取得
            const cardsArray = this.cardData.items[prefectureKey]?.childrenInfo?.cards;
            if (cardsArray && Array.isArray(cardsArray)) {
                console.log(`cardsArray for ${prefectureKey}:`, cardsArray);
    
                // カードキーの配列をshowChildrenCardsに渡す
                this.hideAllCards();  // すべてのカードを非表示に
                this.previousKeys.push(prefectureKey);
                this.showChildrenCards(cardsArray,3,70,105,-100,230);  // 子カードを表示する
            } else {
                console.log(`cardsArray for ${prefectureKey} does not exist.`);
            }
        }else if(userData.wakuKey === 'hireiku'){
            const prefectureKey = this.addProportionalBlock(this.addPrefectureSuffix(this.selectedPrefecture.split(' ')[0]));
            if(prefectureKey === null){console.log("hireiku error");}
            const cardsArray = this.cardData.items[prefectureKey]?.childrenInfo?.cards;
            if (cardsArray && Array.isArray(cardsArray)) {
                console.log(`cardsArray for ${prefectureKey}:`, cardsArray);

                this.hideAllCards();  // すべてのカードを非表示に
                this.previousKeys.push(prefectureKey);
                this.showProportionalByParty(cardsArray);  // 党別にカードを配置
            } else {
                console.log(`cardsArray for ${prefectureKey} does not exist.`);
            }
        }else if(this.isSeitouID(userData.wakuKey)){
            // cardData.itemsから直接childrenInfo.cardsを取得
            const cardsArray = this.cardData.items[userData.wakuKey]?.childrenInfo?.cards;
            if (cardsArray && Array.isArray(cardsArray)) {
                console.log(`cardsArray for ${userData.wakuKey}:`, cardsArray);
    
                // カードキーの配列をshowChildrenCardsに渡す
                this.hideAllCards();  // すべてのカードを非表示に
                this.previousKeys.push(userData.wakuKey);
                this.showChildrenCards(cardsArray,3,80,105,-100,200);  // 子カードを表示する
            } else {
                console.log(`cardsArray for ${userData.wakuKey} does not exist.`);
            }
        }else if(aiueoKeys){
            // aiueo のグループがクリックされた場合は、各行の候補カードを展開
            const candidateKeys = [];
            for (const key of aiueoKeys) {
                const cards = this.cardData.items[key]?.childrenInfo?.cards;
                if (cards && Array.isArray(cards)) {
                    candidateKeys.push(...cards);
                }
            }
            this.hideAllCards();  // すべてのカードを非表示に
            this.previousKeys.push(aiueoKeys[0]);
            this.showChildrenCards(candidateKeys, 3, 70, 105, -100, 230);  // 子カードを表示する
        }
    }

    // 都道府県に対応する比例代表ブロックを返すメソッド
    addProportionalBlock(prefectureKey) {
        // 参議院では比例代表は単一全国区となるため常に同じ値を返す
        return "比例代表";
    }

 
    castAIUOEIDtoCardDataKey(strId){
        if (strId === "a") return ["あ", "い", "う", "え", "お"];
        if (strId === "ka") return ["か", "き", "く", "け", "こ"];
        if (strId === "sa") return ["さ", "し", "す", "せ", "そ"];
        if (strId === "ta") return ["た", "ち", "つ", "て", "と"];
        if (strId === "na") return ["な", "に", "ぬ", "ね", "の"];
        if (strId === "ha") return ["は", "ひ", "ふ", "へ", "ほ"];
        if (strId === "ma") return ["ま", "み", "む", "め", "も"];
        if (strId === "ya") return ["や", "ゆ", "よ"];  // 「や行」は「や」「ゆ」「よ」のみ
        if (strId === "ra") return ["ら", "り", "る", "れ", "ろ"];
        if (strId === "wa") return ["わ", "を"];  // 「わ行」は「わ」と「を」のみ
        return false;
    }

    isSeitouID(strId){
        if(strId === "zimin") return true;
        if(strId === "koumei") return true;
        if(strId === "rikken") return true;
        if(strId === "ishin") return true;
        if(strId === "kyousan") return true;
        if(strId === "kokumin") return true;
        if(strId === "reiwa") return true;
        if(strId === "shamin") return true;
        if(strId === "sansei") return true;
        if(strId === "nippo") return true;
        if(strId === "mintsuku") return true;
        if(strId === "nkoku") return true;
        if(strId === "saidou") return true;
        if(strId === "mirai") return true;
        if(strId === "nikai") return true;
        if(strId === "nissei") return true;
        if(strId === "nichiie") return true;
        if(strId === "yamato") return true;
        if(strId === "sabetsu") return true;
        if(strId === "kakuyu") return true;
        if(strId === "genzei") return true;
        if(strId === "kunimori") return true;
        if(strId === "tafu") return true;
        if(strId === "kokuga") return true;
        if(strId === "shinsha") return true;
        if(strId === "anshi") return true;
        if(strId === "mushozoku") return true;
        if(strId === "shoha") return true;
        if(strId === "fumei") return true;
        return false;
    }
    
    showChildrenCards(cardKeys, columnCount = 2, rowSpacing = 70, columnSpacing = 150, startX = -(2 / 2) * 150 + 80, startY = 200) {
        clearTimeout(this.hideCardsTimeout);
    
        cardKeys.forEach((cardKey, index) => {
            if (!this.cardData.getItem(cardKey)) {
                console.warn(`Card data for ${cardKey} not found.`);
                return;
            }
            const row = Math.floor(index / columnCount);  // 行の計算
            const col = index % columnCount;  // 列の計算
    
            const position = {
                x: startX + col * columnSpacing,  // x座標の計算
                y: startY - row * rowSpacing,  // y座標の計算
                z: 100  // z座標は固定
            };
            const rotation = { x: 0, y: 0, z: 0 };  // 回転はすべて0
    
            // threeObjectsから該当カードを取得
            let cardObject = this.threeObjects[cardKey];
    
            // 該当カードがない場合は新規作成
            if (!cardObject) {
                console.log(`No threeObject found for cardKey: ${cardKey}. Creating...`);
                this.createCard(cardKey);  // 新しくカードオブジェクトを生成
                cardObject = this.threeObjects[cardKey];  // 再取得
            }
    
            // 取得できたらアニメーション
            if (cardObject) {
                this.animateCardTransform(cardKey, { position, rotation }, 2000, true);  // visibleをtrueにしてアニメーション
            } else {
                console.error(`Failed to create or retrieve threeObject for cardKey: ${cardKey}`);
            }
        });
    }

    // 比例代表候補を政党ごとに並べて表示する
    showProportionalByParty(cardKeys, startX = -100, startY = 220, groupSpacing = 50, columnSpacing = 105) {
        clearTimeout(this.hideCardsTimeout);

        // カードを遠ざけて小さく見せる
        const wakuZ = 100;      // 党名カードのZ座標
        const candidateZ = 100; // 候補カードのZ座標

        // 政党ごとにカードIDをグループ化
        const groups = {};
        for (const cardKey of cardKeys) {
            const card = this.cardData.getItem(cardKey);
            if (!card) continue;
            let partyKey = this.partyKeyMap[card.seitou] || card.seitou;
            if (!this.waku[partyKey]) partyKey = 'fumei';
            if (!groups[partyKey]) groups[partyKey] = [];
            groups[partyKey].push(cardKey);
        }

        // 表示順は showPartyWaku と同じ
        const partyOrder = [
            "zimin", "koumei", "rikken", "ishin", "kyousan", "kokumin", "reiwa",
            "shamin", "sansei", "nippo", "mintsuku", "nkoku", "saidou",
            "mirai", "nikai", "nissei", "nichiie", "yamato", "sabetsu", "kakuyu",
            "genzei", "kunimori", "tafu", "kokuga", "shinsha", "mushozoku",
            "shoha", "fumei"
        ];

        this.hideAllWaku();

        let groupIndex = 0;
        const candidateOffsetY = 0; // 党名カードから候補カードまでの距離をなくす

        for (const key of partyOrder) {
            const members = groups[key];
            if (!members) continue;

            const baseY = startY - groupIndex * groupSpacing;

            // 党名カードを配置
            this.waku[key].visible = true;
            this.transformWaku({ wakuKey: key }, startX, baseY, wakuZ);

            // 候補カードを横一列に配置
            members.forEach((memberKey, idx) => {
                let cardObject = this.threeObjects[memberKey];
                if (!cardObject) {
                    this.createCard(memberKey);
                    cardObject = this.threeObjects[memberKey];
                }
                const position = {
                    x: startX + (idx + 1) * columnSpacing,
                    y: baseY - candidateOffsetY,
                    z: candidateZ
                };
                const rotation = { x: 0, y: 0, z: 0 };
                this.animateCardTransform(memberKey, { position, rotation }, 2000, true);
            });

            groupIndex++;
        }
    }
    
    
    
    
    
        

    hideAllWaku(exceptId = null, duration = 2000) {
        for (const key in this.waku) {
            if (this.waku.hasOwnProperty(key)) {
                // exceptIdに該当する枠だけ非表示にしない
                if (key !== exceptId) {
                    this.waku[key].visible = false;
                    const userData = { wakuKey: key };
                    // Z座標を0に移動させる
                    this.transformWaku(userData, this.waku[key].position.x, this.waku[key].position.y, -200, duration);
                }
            }
        }
    }
    
    
    

    showWakuShousenkyokuOrHirei(){
        const keyShousenkyoku = "shousenkyoku";
        const keyHireiku = "hireiku";
        this.waku[keyShousenkyoku].visible = true;
        this.waku[keyHireiku].visible = true;
        this.transformWaku({wakuKey:keyShousenkyoku}, -60, 0, 210);
        this.transformWaku({wakuKey:keyHireiku}, 60, 0, 210);
    }

    showAiueoWaku(xPitch = 120, yPitch = 50) {
        // 政党キーの配列
        const partyKeys = [
            "a",
            "ka",
            "sa",
            "ta",
            "na",
            "ha",
            "ma",
            "ya",
            "ra",
            "wa"
        ];
    
        let index = 0;
        for (const key of partyKeys) {
            const column = index % 2;  // 2列に並べる
            const row = Math.floor(index / 2);  // 行の数を決める
            
            // 表示する枠を設定
            this.waku[key].visible = true;
            
            // 位置を設定
            const positionX = column * xPitch - xPitch / 2;  // x位置調整
            const positionY = -row * yPitch +100;  // y位置調整

            this.transformWaku({ wakuKey: key }, positionX, positionY, 210);
            index++;
        }
    }

    showPartyWaku(xPitch = 120, yPitch = 50) {
        // 政党キーの配列
        const partyKeys = [
            "zimin",
            "koumei",
            "rikken",
            "ishin",
            "kyousan",
            "kokumin",
            "reiwa",
            "shamin",
            "sansei",
            "nippo",
            "mintsuku",
            "nkoku",
            "saidou",
            "mirai",
            "nikai",
            "nissei",
            "nichiie",
            "yamato",
            "sabetsu",
            "kakuyu",
            "genzei",
            "kunimori",
            "tafu",
            "kokuga",
            "shinsha",
            "mushozoku",
            "shoha",
            "fumei"
        ];
    
        let index = 0;
        for (const key of partyKeys) {
            const column = index % 2;  // 2列に並べる
            const row = Math.floor(index / 2);  // 行の数を決める
            
            // 表示する枠を設定
            this.waku[key].visible = true;
            
            // 位置を設定
            const positionX = column * xPitch - xPitch / 2;  // x位置調整
            const positionY = -row * yPitch +100;  // y位置調整

            this.transformWaku({ wakuKey: key }, positionX, positionY, 210);
            index++;
        }
    }
    

    transformWaku(userData, positionX, positionY, positionZ, duration = 2000){
        const mesh = this.waku[userData.wakuKey];
        new TWEEN.Tween(mesh.position)
        .to({ x: positionX, y:positionY, z: positionZ }, duration)
        .easing(TWEEN.Easing.Exponential.InOut)
        .start();
    }

    createWakuMesh(key, label, strColor = "#000000"){
        const position = {
            x: Math.random() * 400 - 200,
            y: Math.random() * 400 - 200,
            z: Math.random() * 400 - 200
        };
        // オブジェクトを描画するために使う基本の形状とマテリアル
        const geometry = new THREE.PlaneGeometry(100, 30);  // 適当な平面ジオメトリを作成
    
        // 透過処理を設定したマテリアルを作成
        const material = new THREE.MeshBasicMaterial({
            color: strColor, 
            side: THREE.DoubleSide, 
            transparent: true,  // 透過を有効に
            opacity: 0.8  // 背景は完全に透明に
        });
        
        const mesh = new THREE.Mesh(geometry, material);  // メッシュを生成
        // オフセットを適用した位置を設定
        mesh.position.x = position.x;
        mesh.position.y = position.y;
        mesh.position.z = position.z;
    
        // 枠線の追加
        const edges = new THREE.EdgesGeometry(geometry);  // ジオメトリからエッジを取得
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff }); 
        const line = new THREE.LineSegments(edges, lineMaterial);  // エッジにラインを追加
        mesh.add(line);  // メッシュに枠線を追加
    
    
        // イベントリスナーの設定
        mesh.userData.wakuKey = key;  // メッシュの `userData` に `cardId` を格納
        mesh.userData.wakuValue = label;     

        const symbolTexture = this.createTextTexture(label, undefined, undefined, undefined, "#00ffff");
        const symbolMaterial = new THREE.MeshBasicMaterial({
            map: symbolTexture,
            side: THREE.DoubleSide,
            transparent: true  // テクスチャを透過に設定
        });
        const symbolMesh = new THREE.Mesh(geometry, symbolMaterial);
        symbolMesh.position.set(0, 0, 0);
        mesh.add(symbolMesh);

        return mesh;
    }


    createCard(key) {
        if (!this.cardData.getItem(key)) {
            console.warn(`Card data for ${key} not found. Skipping card creation.`);
            return;
        }

        // ランダムな座標を生成
        const position = {
            x: Math.random() * 4000 - 2000,
            y: Math.random() * 4000 - 2000,
            z: Math.random() * 4000 - 2000
        };
    
        // 各詳細レベルのオフセットを定義
        const offsets = {
            high: { x: 0, y: 0 },
            medium: { x: 100, y: 100 },
            low: { x: 200, y: 200 }
        };
    
        // LODセットを作成
        /*
        const lodSet = {
            lowDetail: this.createDetailObject(key, 'low', position, offsets.low),
            mediumDetail: this.createDetailObject(key, 'medium', position, offsets.medium),
            highDetail: this.createDetailObject(key, 'high', position, offsets.high)
        };
        */
        const lodSet = {
            highDetail: this.createDetailObject(key, 'high', position, offsets.high)
        };
    
        // すべての詳細レベルのオブジェクトをシーンに追加し、初期状態は非表示に設定
        for (let level in lodSet) {
            this.scene.add(lodSet[level]);
            lodSet[level].visible = false;  // 初期状態で非表示
        }
        // LODセットを保存 (this.threeObjectsに変更)
        this.threeObjects[key] = lodSet;
    }
    
    

    //各詳細レベルのオブジェクトを作成する
    createDetailObject(key, detailLevel, position, offset) {
        const item = this.cardData.getItem(key);
        if (!item) {
            console.warn(`Card data for ${key} not found.`);
            return new THREE.Object3D();
        }

        // if no explicit type but children are present, treat as folder
        const itemType = item.type || (item.childrenInfo && item.childrenInfo.cards ? 'folder' : 'text');

        if(itemType === 'text'){
            return this.createDetailObjectText(key, detailLevel, position, offset);
        }else if(itemType === 'folder'){
            return this.createDetailObjectFolder(key, detailLevel, position, offset);
        }else if(item.type === 'img'){
            return this.createDetailObjectImg(key, detailLevel, position, offset);
        }else if(item.type === 'video-text'){
            return this.createDetailObjectVideoText(key, detailLevel, position, offset);
        }else if(item.type === 'video'){
            return this.createDetailObjectVideo(key, detailLevel, position, offset);
        }else{
            return this.createDetailObjectText(key, detailLevel, position, offset);
        }
    }

    createDetailObjectText(key, detailLevel, position, offset) {
        // オブジェクトを描画するために使う基本の形状とマテリアル
        const geometry = new THREE.PlaneGeometry(100, 30);  // 適当な平面ジオメトリを作成
    
        // 透過処理を設定したマテリアルを作成
        const card = this.cardData.getItem(key);
        let themeColor = '#007f7f';
        if (card) {
            const partyColor = this.getPartyColor(card.seitou);
            if (partyColor) {
                if (card.color) {
                    card.color.theme = partyColor;
                    card.color.politicalParty = partyColor;
                }
                themeColor = partyColor;
            } else if (card.color && card.color.theme) {
                themeColor = card.color.theme;
            }
        }
        const material = new THREE.MeshBasicMaterial({
            color: themeColor,
            side: THREE.DoubleSide,
            transparent: true,  // 透過を有効に
            opacity: 0.5  // 背景は完全に透明に
        });
        
        const mesh = new THREE.Mesh(geometry, material);  // メッシュを生成
    
        // 枠線の追加
        const edges = new THREE.EdgesGeometry(geometry);  // ジオメトリからエッジを取得
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xe0ffff });  // 枠線の色を赤に設定
        const line = new THREE.LineSegments(edges, lineMaterial);  // エッジにラインを追加
        mesh.add(line);  // メッシュに枠線を追加
    
        // オフセットを適用した位置を設定
        mesh.position.x = position.x + offset.x;
        mesh.position.y = position.y + offset.y;
        mesh.position.z = position.z;
    
        // イベントリスナーの設定
        mesh.userData.cardId = key;  // メッシュの `userData` に `cardId` を格納
        mesh.userData.detailLevel = detailLevel;  // メッシュの詳細レベルを保存

        if(!card){
            return mesh;
        }

        /*
        // イベントリスナーの設定
        mesh.addEventListener('mousedown', (e) => {
            this.handleStart(e);
        });
    
        mesh.addEventListener('touchstart', (e) => {
            this.handleStart(e);
        }, { passive: false });
    
        mesh.addEventListener('mouseup', (e) => {
            this.handleMouseUp(e);
        });
    
        mesh.addEventListener('touchend', (e) => {
            this.handleMouseUp(e);
        }, { passive: false });
        */
        // 詳細レベルごとのスタイル設定
        if (detailLevel === 'medium') {
            const symbolTexture = this.createTextTexture(card.title);
            const symbolMaterial = new THREE.MeshBasicMaterial({
                map: symbolTexture,
                side: THREE.DoubleSide,
                transparent: true  // テクスチャを透過に設定
            });
            const symbolMesh = new THREE.Mesh(geometry, symbolMaterial);
            symbolMesh.position.set(0, 0, 0);
            mesh.add(symbolMesh);
        } else if (detailLevel === 'high') {

            const symbolTexture = this.createTextTexture(card.title);
            const symbolMaterial = new THREE.MeshBasicMaterial({
                map: symbolTexture,
                side: THREE.DoubleSide,
                transparent: true  // テクスチャを透過に設定
            });
            const symbolMesh = new THREE.Mesh(geometry, symbolMaterial);
            symbolMesh.position.set(0, 0, 0);
            mesh.add(symbolMesh);

            //選挙区とブロックのときのみ

            if(card.detail && (card.title.slice(-1) == "区" || card.title.slice(-4) == "ブロック")){
                const detailTexture = this.createTextTexture(card.detail.slice(0, 13), 400, 120, '28px sans-serif');
                const detailMaterial = new THREE.MeshBasicMaterial({
                    map: detailTexture,
                    side: THREE.DoubleSide,
                    transparent: true  // テクスチャを透過に設定
                });
                const detailMesh = new THREE.Mesh(geometry, detailMaterial);
                detailMesh.position.set(0, -20, 0);
                mesh.add(detailMesh);


                const detail2texture = this.createTextTexture(card.detail.slice(13,26), 400, 120, '28px sans-serif');
                const detail2Material = new THREE.MeshBasicMaterial({
                    map: detail2texture,
                    side: THREE.DoubleSide,
                    transparent: true  // テクスチャを透過に設定
                });
                const detail2Mesh = new THREE.Mesh(geometry, detail2Material);
                detail2Mesh.position.set(0, -30, 0);
                mesh.add(detail2Mesh);

                const detail3texture = this.createTextTexture(card.detail.slice(26,39), 400, 120, '28px sans-serif');
                const detail3Material = new THREE.MeshBasicMaterial({
                    map: detail3texture,
                    side: THREE.DoubleSide,
                    transparent: true  // テクスチャを透過に設定
                });
                const detail3Mesh = new THREE.Mesh(geometry, detail3Material);
                detail3Mesh.position.set(0, -40, 0);
                mesh.add(detail3Mesh);

                const detail4texture = this.createTextTexture(card.detail.slice(39), 400, 120, '28px sans-serif');
                const detail4Material = new THREE.MeshBasicMaterial({
                    map: detail4texture,
                    side: THREE.DoubleSide,
                    transparent: true  // テクスチャを透過に設定
                });
                const detail4Mesh = new THREE.Mesh(geometry, detail4Material);
                detail4Mesh.position.set(0, -50, 0);
                mesh.add(detail4Mesh);
            }
            //議員カードのときのみ
            const matsubi = card.detail ? card.detail.slice(-1) : "";
            if(card.detail && (matsubi == "前" || matsubi == "元" || matsubi == "新" )){
                const detailTexture = this.createTextTexture(card.detail.slice(0, -2), 400, 120, '28px sans-serif');
                const detailMaterial = new THREE.MeshBasicMaterial({
                    map: detailTexture,
                    side: THREE.DoubleSide,
                    transparent: true  // テクスチャを透過に設定
                });
                const detailMesh = new THREE.Mesh(geometry, detailMaterial);
                detailMesh.position.set(0, -20, 0);
                mesh.add(detailMesh);


                const detail2texture = this.createTextTexture(card.detail.slice(-1) + "  " + card.seitou, 400, 120, '28px sans-serif');
                const detail2Material = new THREE.MeshBasicMaterial({
                    map: detail2texture,
                    side: THREE.DoubleSide,
                    transparent: true  // テクスチャを透過に設定
                });
                const detail2Mesh = new THREE.Mesh(geometry, detail2Material);
                detail2Mesh.position.set(0, 20, 0);
                mesh.add(detail2Mesh);
                //壺議員アイコン
                const tuboInfo = card.tubohantei;
                if(tuboInfo !== ""){
                    const tuboTexture = this.createTextTexture(tuboInfo, 400, 120, '30px sans-serif', '#ff0000');
                    const tuboMaterial = new THREE.MeshBasicMaterial({
                        map: tuboTexture,
                        side: THREE.DoubleSide,
                        transparent: true  // テクスチャを透過に設定
                    });
                    const tuboMesh = new THREE.Mesh(geometry, tuboMaterial);
                    tuboMesh.position.set(-30, 28, 0);
                    mesh.add(tuboMesh);
                }
                //裏金議員アイコン
                const uraganeInfo = card.uraganehantei;
                if(uraganeInfo !== ""){
                    const uraganeTexture = this.createTextTexture(uraganeInfo, 400, 120, '30px sans-serif', '#ff31ba');
                    const uraganeMaterial = new THREE.MeshBasicMaterial({
                        map: uraganeTexture,
                        side: THREE.DoubleSide,
                        transparent: true  // テクスチャを透過に設定
                    });
                    const uraganeMesh = new THREE.Mesh(geometry, uraganeMaterial);
                    uraganeMesh.position.set(30, 28, 0);
                    mesh.add(uraganeMesh);
                }
            }
            //議員カードのときのみ
        }
    
        return mesh;
    }

    createTextTexture(text, width = 400, height = 120, font = '48px sans-serif', fillStyle = '#ffffff', backgroundColor = "") {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        // Canvasのサイズを調整
        canvas.width = width;
        canvas.height = height;

        // 背景色の設定
        if (backgroundColor) {
            // 背景色が指定されている場合、その色で塗りつぶす
            context.fillStyle = backgroundColor;
            context.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            // 背景を透明にクリア
            context.clearRect(0, 0, canvas.width, canvas.height);
        }

        // テキストスタイルを設定
        context.font = font;
        context.fillStyle = fillStyle;  // 文字色
        context.textAlign = "center";
        context.textBaseline = 'middle';

        // テキストを描画
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        // 背景が透過されたテクスチャを生成
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        // 背景色がある場合は透過を無効にする
        texture.transparent = backgroundColor === "";

        return texture;
    }


    
    
    createDetailObjectFolder(key, detailLevel, position, offset) {
        // オブジェクトを描画するために使う基本の形状とマテリアル
        const geometry = new THREE.PlaneGeometry(100, 30);  // 適当な平面ジオメトリを作成
    
        // 透過処理を設定したマテリアルを作成
        const material = new THREE.MeshBasicMaterial({
            color: 0x000000, 
            side: THREE.DoubleSide, 
            transparent: true,  // 透過を有効に
            opacity: 0  // 背景は完全に透明に
        });
        
        const mesh = new THREE.Mesh(geometry, material);  // メッシュを生成
    
        // 枠線の追加
        const edges = new THREE.EdgesGeometry(geometry);  // ジオメトリからエッジを取得
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff }); 
        const line = new THREE.LineSegments(edges, lineMaterial);  // エッジにラインを追加
        mesh.add(line);  // メッシュに枠線を追加
    
        // オフセットを適用した位置を設定
        mesh.position.x = position.x + offset.x;
        mesh.position.y = position.y + offset.y;
        mesh.position.z = position.z;
    
        // イベントリスナーの設定
        mesh.userData.cardId = key;  // メッシュの `userData` に `cardId` を格納
        mesh.userData.detailLevel = detailLevel;  // メッシュの詳細レベルを保存
    
        // イベントリスナーの設定
        mesh.addEventListener('mousedown', (e) => {
            this.handleStart(e);
        });
    
        mesh.addEventListener('touchstart', (e) => {
            this.handleStart(e);
        }, { passive: false });
    
        mesh.addEventListener('mouseup', (e) => {
            this.handleMouseUp(e);
        });
    
        mesh.addEventListener('touchend', (e) => {
            this.handleMouseUp(e);
        }, { passive: false });
    
        // 詳細レベルごとのスタイル設定
        if (detailLevel === 'medium') {
            const symbolTexture = this.createTextTexture(this.cardData.getItem(key).title);
            const symbolMaterial = new THREE.MeshBasicMaterial({
                map: symbolTexture,
                side: THREE.DoubleSide,
                transparent: true  // テクスチャを透過に設定
            });
            const symbolMesh = new THREE.Mesh(geometry, symbolMaterial);
            symbolMesh.position.set(0, 0, 0);
            mesh.add(symbolMesh);
        } else if (detailLevel === 'high') {
            
            const symbolTexture = this.createTextTexture(this.cardData.getItem(key).title);
            const symbolMaterial = new THREE.MeshBasicMaterial({
                map: symbolTexture,
                side: THREE.DoubleSide,
                transparent: true  // テクスチャを透過に設定
            });
            const symbolMesh = new THREE.Mesh(geometry, symbolMaterial);
            symbolMesh.position.set(0, 0, 0);
            mesh.add(symbolMesh);

            const detailTexture = this.createTextTexture(this.cardData.getItem(key).detail);
            const detailMaterial = new THREE.MeshBasicMaterial({
                map: detailTexture,
                side: THREE.DoubleSide,
                transparent: true  // テクスチャを透過に設定
            });
            const detailMesh = new THREE.Mesh(geometry, detailMaterial);
            detailMesh.position.set(0, -30, 0);
            mesh.add(detailMesh);
        }
    
        return mesh;
    }



    createDetailObjectVideoText(key, detailLevel, position, offset) {
        const element = document.createElement('div');
        element.className = `element ${detailLevel}-detail`;
        element.cardId = key;
    
        // イベントリスナーの設定
        element.addEventListener('mousedown', (e) => {
            this.handleStart(e);
        });
    
        element.addEventListener('touchstart', (e) => {
            this.handleStart(e);
        }, { passive: false });
    
        element.addEventListener('mouseup', (e) => {
            this.handleMouseUp(e);
        });
    
        element.addEventListener('touchend', (e) => {
            this.handleMouseUp(e);
        }, { passive: false });
    
        const objectCSS = new CSS3DObject(element);
        objectCSS.cardId = key;
    
        // element に objectCSS への参照を追加
        element.objectCSS = objectCSS;
    
        // オフセットを適用した位置を設定
        objectCSS.position.x = position.x + offset.x;
        objectCSS.position.y = position.y + offset.y;
        objectCSS.position.z = position.z;
    
        // 詳細レベルごとのスタイル設定
        if (detailLevel === 'low') {
            // Low Detailの処理
        } else if (detailLevel === 'medium') {
            const symbol2 = document.createElement('textarea');
            symbol2.className = 'title';
            symbol2.cardId = key;
            symbol2.textContent = this.cardData.getItem(key).title;
            element.appendChild(symbol2);
        } else {
            // High Detail の場合
            const number = document.createElement('div');
            number.className = 'number';
            number.cardId = key;
            number.textContent = "X";
    
            number.addEventListener('mousedown', this.deleteCardBind);
            number.addEventListener('touchstart', this.deleteCardBind);
            element.appendChild(number);
    
            const symbol = document.createElement('textarea');
            symbol.className = 'symbol';
            symbol.cardId = key;
            symbol.textContent = this.cardData.getItem(key).title;
            element.appendChild(symbol);
    
            symbol.addEventListener('change', (event) => {
                const key = event.target.cardId;
                const newTitle = event.target.value;
            
                // カードデータを更新
                this.cardData.getItem(key).title = newTitle;
            
                // mediumDetail のタイトルを更新
                const mediumTitleElement = this.threeObjects[key]["mediumDetail"].element.querySelector('.title');
                if (mediumTitleElement) {
                    mediumTitleElement.value = newTitle;
                }
            
                this.cardData.saveLocalStorage();
            });
    
            const details = document.createElement('textarea');
            details.className = 'details';
            details.cardId = key;
            details.textContent = this.cardData.getItem(key).detail;
            details.style.height = '50%'; // 高さを半分に設定
            details.style.position = 'absolute';
            details.style.bottom = '0'; // 下に配置
            element.appendChild(details);
    
            details.addEventListener('change', (event) => {
                const key = event.target.cardId;
                this.cardData.getItem(key).detail = event.target.value;
                this.cardData.saveLocalStorage();
            });
    
            // 要件2: 動画要素を追加
            const videoPath = this.cardData.getItem(key).video;
            if (videoPath) {
                const videoElement = document.createElement('video');
                videoElement.src = `./video/${videoPath}`; // 動画パスの先頭に ./video/ を追加
                videoElement.style.width = '100%'; // 動画を幅100%に設定
                videoElement.style.height = '50%'; // 空いたスペースに動画を表示
                videoElement.controls = true; // コントロールを表示
                element.appendChild(videoElement);
            }
        }
    
        return objectCSS;
    }
    
    createDetailObjectImg(key, detailLevel, position, offset) {
        const element = document.createElement('div');
        element.className = `element ${detailLevel}-detail`;
        element.cardId = key;
    
        // イベントリスナーの設定
        element.addEventListener('mousedown', (e) => {
            this.handleStart(e);
        });
    
        element.addEventListener('touchstart', (e) => {
            this.handleStart(e);
        }, { passive: false });
    
        element.addEventListener('mouseup', (e) => {
            this.handleMouseUp(e);
        });
    
        element.addEventListener('touchend', (e) => {
            this.handleMouseUp(e);
        }, { passive: false });
    
        const objectCSS = new CSS3DObject(element);
        objectCSS.cardId = key;
    
        // element に objectCSS への参照を追加
        element.objectCSS = objectCSS;
    
        // オフセットを適用した位置を設定
        objectCSS.position.x = position.x + offset.x;
        objectCSS.position.y = position.y + offset.y;
        objectCSS.position.z = position.z;
    
        // 詳細レベルごとのスタイル設定
        if (detailLevel === 'low') {
            // Low Detailの処理
        } else if (detailLevel === 'medium') {
            const symbol2 = document.createElement('textarea');
            symbol2.className = 'title';
            symbol2.cardId = key;
            symbol2.textContent = this.cardData.getItem(key).title;
            element.appendChild(symbol2);
        } else {
            // High Detail の場合
            const number = document.createElement('div');
            number.className = 'number';
            number.cardId = key;
            number.textContent = "X";
    
            number.addEventListener('mousedown', this.deleteCardBind);
            number.addEventListener('touchstart', this.deleteCardBind);
            element.appendChild(number);
    
            const symbol = document.createElement('textarea');
            symbol.className = 'symbol';
            symbol.cardId = key;
            symbol.textContent = this.cardData.getItem(key).title;
            element.appendChild(symbol);
    
            symbol.addEventListener('change', (event) => {
                const key = event.target.cardId;
                const newTitle = event.target.value;
            
                // カードデータを更新
                this.cardData.getItem(key).title = newTitle;
            
                // mediumDetail のタイトルを更新
                const mediumTitleElement = this.threeObjects[key]["mediumDetail"].element.querySelector('.title');
                if (mediumTitleElement) {
                    mediumTitleElement.value = newTitle;
                }
            
                this.cardData.saveLocalStorage();
            });
    
            // 要件に応じて本文のテキストエリアは生成しない
    
            // 画像要素を追加
            const imgPath = this.cardData.getItem(key).img;
            if (imgPath) {
                const imgElement = document.createElement('img');
                imgElement.src = `./img/${imgPath}`; // 画像パスの先頭に ./img/ を追加
                imgElement.style.width = '100%'; // 画像を幅100%に設定
                imgElement.style.height = '100%'; // 画像をカード全体に表示
                imgElement.style.objectFit = 'cover'; // 画像の縦横比を維持して埋める
                element.appendChild(imgElement);
            }
        }
    
        return objectCSS;
    }

    createDetailObjectVideo(key, detailLevel, position, offset) {
        const element = document.createElement('div');
        element.className = `element ${detailLevel}-detail`;
        element.cardId = key;
    
        // イベントリスナーの設定
        element.addEventListener('mousedown', (e) => {
            this.handleStart(e);
        });
    
        element.addEventListener('touchstart', (e) => {
            this.handleStart(e);
        }, { passive: false });
    
        element.addEventListener('mouseup', (e) => {
            this.handleMouseUp(e);
        });
    
        element.addEventListener('touchend', (e) => {
            this.handleMouseUp(e);
        }, { passive: false });
    
        const objectCSS = new CSS3DObject(element);
        objectCSS.cardId = key;
    
        // element に objectCSS への参照を追加
        element.objectCSS = objectCSS;
    
        // オフセットを適用した位置を設定
        objectCSS.position.x = position.x + offset.x;
        objectCSS.position.y = position.y + offset.y;
        objectCSS.position.z = position.z;
    
        // 詳細レベルごとのスタイル設定
        if (detailLevel === 'low') {
            // Low Detailの処理
        } else if (detailLevel === 'medium') {
            const symbol2 = document.createElement('textarea');
            symbol2.className = 'title';
            symbol2.cardId = key;
            symbol2.textContent = this.cardData.getItem(key).title;
            element.appendChild(symbol2);
        } else {
            // High Detail の場合
            const number = document.createElement('div');
            number.className = 'number';
            number.cardId = key;
            number.textContent = "X";
    
            number.addEventListener('mousedown', this.deleteCardBind);
            number.addEventListener('touchstart', this.deleteCardBind);
            element.appendChild(number);
    
            const symbol = document.createElement('textarea');
            symbol.className = 'symbol';
            symbol.cardId = key;
            symbol.textContent = this.cardData.getItem(key).title;
            element.appendChild(symbol);
    
            symbol.addEventListener('change', (event) => {
                const key = event.target.cardId;
                const newTitle = event.target.value;
            
                // カードデータを更新
                this.cardData.getItem(key).title = newTitle;
            
                // mediumDetail のタイトルを更新
                const mediumTitleElement = this.threeObjects[key]["mediumDetail"].element.querySelector('.title');
                if (mediumTitleElement) {
                    mediumTitleElement.value = newTitle;
                }
            
                this.cardData.saveLocalStorage();
            });
    
            // 修正部分: 本文のテキストエリアを生成せず、動画をフルに表示
            const videoPath = this.cardData.getItem(key).video;
            if (videoPath) {
                const videoElement = document.createElement('video');
                videoElement.src = `./video/${videoPath}`; // 動画パスの先頭に ./video/ を追加
                videoElement.style.width = '100%'; // 動画を幅100%に設定
                videoElement.style.height = '100%'; // 動画を高さ100%に設定
                videoElement.controls = true; // コントロールを表示
                element.appendChild(videoElement);
            }
        }
    
        return objectCSS;
    }
    

    // Card配列関連
    arangePositions() {
        const vector = new THREE.Vector3();

        // カードの総数を取得
        const keys = Object.keys(this.threeObjects);
        const l = keys.length;

        // aiueo configuration
        this.targets.aiueo = [];
        let i = 0;
        const totalCards = Object.keys(this.threeObjects).length;
        const sqrtCount = Math.ceil(Math.sqrt(totalCards));  // 正方形の一辺の数
        const xPitch = 120;  // X軸のピッチ
        const yPitch = 50;   // Y軸のピッチ
        for (let key in this.threeObjects) {
            const object = new THREE.Object3D();
            
            const row = Math.floor(i / sqrtCount);  // 行を決定
            const col = i % sqrtCount;  // 列を決定
            
            object.position.x = (col * xPitch) - (xPitch * (sqrtCount / 2));  // 中央揃え
            object.position.y = -(row * yPitch) + (yPitch * (sqrtCount / 2)); // 中央揃え
            object.position.z = -1000;  // Z軸の値は固定
        
            this.targets.aiueo.push(object);
            i++;
        }

        // Free configuration
        this.targets.free = this.targets.aiueo;


        // Calendar configuration
        this.targets.calendar = this.targets.aiueo;


        // theme configuration
        this.targets.theme = this.targets.aiueo;


        // map configuration
        this.targets.map = this.targets.aiueo;
 



        // politicalParty configuration
        this.targets.politicalParty = this.targets.aiueo;

    }

    // 16進数カラーをRGBAに変換する関数
    hexToRgba(hex) {
        let c;
        // まず文字列の長さで場合分け
        const hexLength = hex.length;
    
        if (hexLength === 9) {
            // 8桁 (RGBA形式) のカラーコード
            c = hex.substring(1).split('');
            const r = parseInt(c[0] + c[1], 16);
            const g = parseInt(c[2] + c[3], 16);
            const b = parseInt(c[4] + c[5], 16);
            const a = parseInt(c[6] + c[7], 16) / 255; // アルファ値を0-1の範囲に変換
            return { r, g, b, a };
        } else if (hexLength === 7) {
            // 6桁 (RGB形式) のカラーコード
            c = hex.substring(1).split('');
            c = '0x' + c.join('');
            const r = (c >> 16) & 255;
            const g = (c >> 8) & 255;
            const b = c & 255;
            const a = 1; // アルファ値は指定されていないためデフォルトで1（不透明）
            return { r, g, b, a };
        } else if (hexLength === 4) {
            // 3桁 (RGB形式) のカラーコード
            c = hex.substring(1).split('');
            c = [c[0], c[0], c[1], c[1], c[2], c[2]]; // 3桁を6桁に変換
            c = '0x' + c.join('');
            const r = (c >> 16) & 255;
            const g = (c >> 8) & 255;
            const b = c & 255;
            const a = 1; // アルファ値は指定されていないためデフォルトで1
            return { r, g, b, a };
        } else {
            // それ以外の無効な16進数カラーコードの場合
            throw new Error('Bad Hex: ' + hex);
        }
    }

    animateColorChange(cardKey, targetColor, duration) {

        const lodSet = this.threeObjects[cardKey];
        if (!lodSet) {
            //console.warn(`CSS3Object not found for key: ${cardKey}`);
            return;
        }
    
        // 色の指定が16進数形式ならRGBAに変換
        if (typeof targetColor === 'string' && targetColor.startsWith('#')) {
            targetColor = this.hexToRgba(targetColor);  // 16進数をRGBAに変換する関数
        }
    
        for (let level in lodSet) {
            const object = lodSet[level];
    
            // three.js オブジェクトのカラー変更
            if (targetColor && object.material) {
                const initialColor = {
                    r: object.material.color.r,
                    g: object.material.color.g,
                    b: object.material.color.b
                };
                const finalColor = {
                    r: targetColor.r / 255,
                    g: targetColor.g / 255,
                    b: targetColor.b / 255
                };
    
                // Tweenで色を変える
                new TWEEN.Tween(initialColor)
                    .to(finalColor, duration)
                    .easing(TWEEN.Easing.Quadratic.InOut)
                    .onUpdate(() => {
                        object.material.color.setRGB(initialColor.r, initialColor.g, initialColor.b);
                    })
                    .start();
            }
        }
    }
    

    // カードの色変更と位置移動を統合したメソッド
    animateCardTransform(cardKey, targetData, duration, changeVisible) {
        
        const lodSet = this.threeObjects[cardKey];
        if (!lodSet) {
            console.warn(`CSS3Object not found for key: ${cardKey}`);
            return;
        }

        const position = targetData.position || { x: 0, y: 0, z: 0 };
        const rotation = targetData.rotation || { x: 0, y: 0, z: 0 };
        let color = targetData.color;


        // もしcolorが16進数形式 (#0014F0 のような形式)で格納されていた場合
        if (typeof color === 'string' && color.startsWith('#')) {
            color = this.hexToRgba(color);  // 16進数をRGBAに変換する関数
        }

        for (let level in lodSet) {
            const object = lodSet[level];
            if(changeVisible == true){
                object.visible = true;
            }

            // 共通のアニメーション処理
            this.animateObjectTransform(object, position, rotation, duration);

            // three.js オブジェクトのカラー変更
            if (color && object.material) {
                const initialColor = {
                    r: object.material.color.r,
                    g: object.material.color.g,
                    b: object.material.color.b
                };
                const targetColor = {
                    r: color.r / 255,
                    g: color.g / 255,
                    b: color.b / 255
                };


                // Tweenで色を変える
                new TWEEN.Tween(initialColor)
                    .to(targetColor, duration)
                    .easing(TWEEN.Easing.Quadratic.InOut)
                    .onUpdate(() => {
                        object.material.color.setRGB(initialColor.r, initialColor.g, initialColor.b);
                    })
                    .start();
            }
        }
    }


    transformSelectedCards(cardsData, duration) {
        this.cardTweenGroup.removeAll();

        for (let key in cardsData) {
            const targetData = cardsData[key];
            this.animateCardTransform(key, targetData, duration);
        }
    }

    transform(target, duration, changeVisible = true) {
        
        this.cardTweenGroup.removeAll();

        const keys = Object.keys(this.threeObjects);
        const l = keys.length;

        for (let i = 0; i < l; i++) {
            const key = keys[i];
            const targetPosition = target[i];
            const cardItem = this.cardData.getItem(key);

            if (!cardItem) {
                console.warn(`CardItem not found for key: ${key}`);
                continue;
            }

            let targetColor;
            const cardColor = cardItem && cardItem.color ? cardItem.color.theme : '#007f7f';
            if (this.arrangeMode === "theme") {
                targetColor = cardColor;
            } else if (this.arrangeMode === "map") {
                targetColor = cardColor;
            } else if (this.arrangeMode === "aiueo") {
                targetColor = cardColor;
            } else if (this.arrangeMode === "politicalParty") {
                targetColor = cardColor;
            }

            if (typeof targetColor === 'string' && targetColor.startsWith('#')) {
                targetColor = this.hexToRgba(targetColor);
            }

            this.animateCardTransform(key, { position: targetPosition.position, rotation: targetPosition.rotation, color: targetColor }, duration, changeVisible);
        }
    }

    // アニメーション処理の共通メソッド
    animateObjectTransform(object, targetPosition, targetRotation, duration) {
        new TWEEN.Tween(object.position, this.cardTweenGroup)
            .to({
                x: targetPosition.x,
                y: targetPosition.y,
                z: targetPosition.z
            }, Math.random() * duration + duration)
            .easing(TWEEN.Easing.Exponential.InOut)
            .start();

        new TWEEN.Tween(object.rotation, this.cardTweenGroup)
            .to({
                x: targetRotation.x,
                y: targetRotation.y,
                z: targetRotation.z
            }, Math.random() * duration + duration)
            .easing(TWEEN.Easing.Exponential.InOut)
            .start();
    }
        
    hideAllCards(exceptKey = "") {
        for (let key in this.threeObjects) {
            const lodSet = this.threeObjects[key];
            if(exceptKey === "" || key !== exceptKey){
                for (let level in lodSet) {
                    lodSet[level].visible = false;  // カードのすべてのレベルを非表示に
                }
            }
        }
    }

}
