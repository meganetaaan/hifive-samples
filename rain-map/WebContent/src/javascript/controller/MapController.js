/*
 * Copyright (C) 2014 NS Solutions Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
(function($) {

	//requestAnimationFrameが使えるか確認
	var requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || 
	function(func) {
		window.setTimeout(func, 15);
	};

	//TracjballControlsのコンストラクタ
	var TrackballControls = THREE.TrackballControls;


	//カメラの初期パラメータ
	var DEFAULTCAMERAPOS = new THREE.Vector3(10, -120, 150);
	var DEFAULTCAMERALOOKAT = new THREE.Vector3(0, 0, 0);

	//プライベートプロパティ
	var _mapData = null;
	var _barData = null;
	
	//地図のTHREEJSオブジェクト
	var _scene = null;
	var _camera = null;
	var _renderer = null;
	var _controls = null;

	//this.ownでthisをバインドして使用する
	var _initCamera = function() {

		// 表示領域の横と縦はバインドされた要素の大きさとする
		var $root = $(this.rootElement);
		var width = $root.width();
		var height = $root.height();

		// cameraの設定
		// 視野の広さ(縦)
		var fieldOfView = 70;
		
		// 撮影領域の縦横比
		var aspect = width / height;
		
		// 撮影範囲
		var near = 10;
		var far = 10000;
		
		_camera = new THREE.PerspectiveCamera(fieldOfView, aspect, near, far);
		_camera.position.set(DEFAULTCAMERAPOS.x, DEFAULTCAMERAPOS.y, DEFAULTCAMERAPOS.z);
		_camera.lookAt(DEFAULTCAMERALOOKAT);

		// トラックコントロールできるようにする
		_controls = new TrackballControls(_camera, this.rootElement);
	};

	// ライトの初期設定
	var _initLight = function() {
		var directionLight = new THREE.DirectionalLight(0xffffff, 2);
		directionLight.position.set(200, -200, 200).normalize();
		_scene.add(directionLight);
	};

	// レンダラの初期化
	var _initRenderer = function() {

		var $root = $(this.rootElement);
		var width = $root.width();
		var height = $root.height();

		_renderer = THREE.WebGLRenderer ? new THREE.WebGLRenderer({	antialias: true}) : new THREE.CanavsRenderer();
		
		// 背景を白くする
		_renderer.setClearColor(new THREE.Color(0xffffff));
		// 描画領域のサイズはバインドされた要素のサイズ
		_renderer.setSize(width, height);
		// バインドされた要素にcanvasを追加
		$root.append(_renderer.domElement);
	};

	// レンダリングするメソッド
	var _render = function() {
		_controls.update();
		_renderer.render(_scene, _camera);
	};

	// scene, camera, renderer, lightの初期化
	var _init = function() {

		// ここでルートエレメントを保存しておく
		var $root = $(this.rootElement);

		// シーンの作成
		_scene = new THREE.Scene();

		// カメラの初期化
		this.own(_initCamera)();

		// ライトの初期化
		_initLight();

		// レンダラの初期化
		this.own(_initRenderer)();

		// 地図を読み込んで描画
		this.setUpMap();
	};

	// 棒グラフのメッシュデータを作成
	var _createBarData = function() {

		_barData = {};
		for ( var key in _mapData) {

			// areaがnullかislandのものはスキップ
			var area = key.split('_')[1];
			if (!area || area === 'null' || area === 'island') {
				continue;
			}

			var mapMesh = _mapData[key];
			
			var sidelength = 2;
			_barData[key] = this.BarMeshCreateLogic.createBarMesh(5, mapMesh, sidelength);
		}
	};


	// 地図のメッシュをsceneに追加
	var _addMap = function() {

		// meshを作成しsceneに配置
		for ( var key in _mapData) {
			var mesh = _mapData[key];
			var edge = new THREE.EdgesHelper(mesh, '#FFF');
			_scene.add(mesh);
			_scene.add(edge);
		}
	};

	// 棒グラフのメッシュをsceneに追加
	var _addBars = function() {
		for ( var key in _barData) {
			var bar = _barData[key];
			_scene.add(bar);
		}
	};

	// 準備が整ったときに一回だけ呼ぶ
	var _renderAuto = function() {

		var f = function() {
			_render();
			requestAnimationFrame(f);
		};

		f();
	};


	/**
	 * バインドした要素にMapを描画するコントローラ パラメータは次の通り { geoDataURL: GeoJSONファイルのURL, }
	 */
	var MapController = {

		__name: 'geo.MapController',

		//ロジック
		MapCreateLogic: geo.MapCreateLogic,
		BarMeshCreateLogic: geo.BarMeshCreateLogic,

		//コントローラ
		IndicatorController: geo.IndicatorController,

		/**
		 * メソッド
		 */
		__ready: function(context) {

			// 必要なパラメータの受け取り
			var geoDataURL = context.args.geoDataURL;
			var mapKeyProps = context.args.mapKeyProps;
			if (!geoDataURL || !mapKeyProps) {
				return;
			}

			//MapCreateLogicにパラメータを渡す．
			this.MapCreateLogic.setMapParams(geoDataURL, mapKeyProps);

			// インジケータの初期化
			this.IndicatorController.showIndicator();

			// 地図のセットアップ
			this.own(_init)();
		},

		// GeoJSONを指定したurlから読み込んでフィールドにセット
		setUpMap: function() {

			// GeoJSONを読む
			// keyで指定した要素をキーとした連想配列を返す
			// keyが空ならgeometryの配列を返す
			this.MapCreateLogic.loadMapData()

			// 取得に成功した場合
			.done(this.own(function(mapData) {

				this.IndicatorController.updateIndicator(20);

				// mapのmeshデータを保持
				_mapData = mapData;


				this.IndicatorController.updateIndicator(80);

				// 棒グラフのmeshデータを保持
				this.own(_createBarData)();


				this.IndicatorController.updateIndicator(90);

				// MapとBarのデータをsceneに追加
				_addMap();
				_addBars();

				// レンダーする
				this.IndicatorController.updateIndicator(100);
				this.trigger('MapSetUpCompleted', null);

				_renderAuto();
			}))

			// 取得に失敗した場合
			.fail(function() {
				console.error('Load Data - Failed');
			});
		},

		// データを渡して棒グラフを更新する
		// データの形式はmapKey => valueのHashMap
		updateBars: function(valueData) {
			
			for ( var key in _barData) {

				var barMesh = _barData[key];
				var newValue = valueData[key] || 0;

				_scene.remove(barMesh);

				if (0 < newValue) {
					var newBarMesh = this.BarMeshCreateLogic.updateBarMesh(newValue, barMesh);
					_barData[key] = newBarMesh;
					_scene.add(newBarMesh);
				}

			}
			_render();
		},

		//カメラをデフォルトの位置と向きに戻す
		resetCamera: function() {
			_initCamera();
		}

	};

	// コントローラを公開
	h5.core.expose(MapController);

})(jQuery);
