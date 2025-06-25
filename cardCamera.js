// cardCamera.js
import * as THREE from 'three';
import TWEEN from 'three/addons/libs/tween.module.js';

export class CardCamera extends THREE.PerspectiveCamera {
    constructor(fov = 40, aspect = window.innerWidth / window.innerHeight, near = 1, far = 10000) {
        super(fov, aspect, near, far);
        this.position.z = 1000;
        this.savedCameraState = {
            position: new THREE.Vector3(),
            target: new THREE.Vector3()
        };
    }

    moveCamera(positionXYZ, targetXYZ, controls) {
        // カメラの位置を即座に更新
        this.position.set(positionXYZ.x, positionXYZ.y, positionXYZ.z);
    
        // controlsとtargetが存在するか確認し、即座にターゲット位置を更新
        if (controls && controls.target) {
            controls.target.set(targetXYZ.x, targetXYZ.y, targetXYZ.z);
            controls.update(); // controlsのターゲット変更を反映させるためにupdate()を呼ぶ
        } else {
            console.warn('Controls or target not defined. Using default target (0, 0, 0)');
            // controlsやtargetがない場合はデフォルトのターゲット座標を設定
            const defaultTarget = new THREE.Vector3(0, 0, 0);
            this.lookAt(defaultTarget); // カメラをデフォルトターゲットに向ける
        }
    }
    
    

    moveToOrigin(controls) {
        this.moveCamera({ x: 0, y: 0, z: 1000 }, { x: 0, y: 0, z: 0 }, controls);
    }

    returnToSavedState(duration, controls) {
        new TWEEN.Tween(this.position)
            .to({ x: this.savedCameraState.position.x, y: this.savedCameraState.position.y, z: this.savedCameraState.position.z }, duration)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();

        new TWEEN.Tween(controls.target)
            .to({ x: this.savedCameraState.target.x, y: this.savedCameraState.target.y, z: this.savedCameraState.target.z }, duration)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();
    }

    moveCameraNormalToCSSobj(targetObject, controls) {
        if (targetObject) {
            let objectPosition = targetObject.position.clone();
            this.moveCamera({ x: objectPosition.x, y: objectPosition.y, z: objectPosition.z + 1500 }, objectPosition, 1000, controls);
        }
    }

    saveCameraState(controls) {
        this.savedCameraState.position.copy(this.position);
        this.savedCameraState.target.copy(controls.target);
    }
}