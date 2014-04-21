/**
    *Name：tab标签页插件
    *Function：1.支持HTML、Ajax、Iframe3种打开方式
                     2.支持自定义打开和关闭动画
                     3.支持标签页固定模式
                     4.支持将页面已存在的标签页添加到TabPage对象上管理
                     5.支持tab图标显示
                     6.支持右击tab操作(下版本实现，[刷新，关闭，复制url])
                     7.支持tab标签z-index升降序（可以实现多种风格的tab，如chrome的tab形式）
                     8.支持tab数量限制
                     9.支持 关闭|关闭前|打开|填充|显示 回调函数
                     10.支持数据储存
    *depend：jquery
	*Author：2goyoung
	*Date：2013-12-03
**/

;
(function (window, $, undefined) {
    var className = {
        tab: 'tab-item',
        page: 'tab-content',
        pageInner: 'tab-content-inner',
        close: 'tab-close',
        closeHover: 'tab-close-hover',
        tabScroll: 'tab-scroll',
        tabScrollContent: 'tab-scroll-content',
        tabScrollView: 'tab-scroll-inner',
        tabScrollPrev: 'tab-arrow-prev',
        tabScrollNext: 'tab-arrow-next'
    }
    var tabHtmlTmpl = ['<{{tag}} id="tab-{{id}}" title="{{title}}" class="', className.tab, ' {{class}}">',
                            '<div class="tab-wrap">',
                                '<div class="tab-inner">',
                                    '<div class="tab-main">',
                                        '<span class="text">{{icon}}{{title}}</span><span class="text-cover"></span>',
                                    '</div>',
                                    '{{closeBtn}}',
                                '</div>',
                            '</div>',
                            '</{{tag}}>'].join('');
    var tabCloseHtml = '<i class="' + className.close + '"></i>';
    var pageHtmlTmpl = '<{{tag}} id="page-{{id}}" class="' + className.page + '">{{content}}</{{tag}}>';
    var tabScrollHtml = '<div class="' + className.tabScroll + '"><div class="' + className.tabScrollView + '"><{{tag}} class="' + className.tabScrollContent + '"></{{tag}}></div><div class="tab-arrow"><i class="' + className.tabScrollPrev + '"><i></i></i><i class="' + className.tabScrollNext + '"><i></i></i></div></div>';
    
    var ieVersion = (function () {
        var v = 3, div = document.createElement('div'), all = div.getElementsByTagName('i');
        while (
            div.innerHTML = '<!--[if gt IE ' + (++v) + ']><i></i><![endif]-->',
            all[0]
        );
        return v > 4 ? v : false;
    }());

    var onAnimate = true,//用来标记是否执行某些动画
          onUpdate = true;//用来标记是否执行更新，一般应用在多动画同时执行时，最后才更新元素状态

    /**
   * TabPage构造函数
   *  @param {options} Object 全局配置对象
   *  @options.tabContainer    String css选择符，放tab的容器，必填
   *  @options.pageContainer   String css选择符，放page的容器，必填
   *  @options.prefix  String 新建页的id前缀(已删除)
   *  @options.activeClass String 当前显示页面的class标识
   *  @options.type String 打开新页面的方式，可选"iframe","html"和"ajax" 默认是iframe,当url不存在时默认为html
   */
    window.TabPage = function (options) {//[tabContainer,pageContainer]

        var _self = this;
        var options = this.options = $.extend({}, TabPage.defaults, options);
        this.index = 0;               //记录页面下标
        this.tmpl = {};               //模版变量
        this.container = {};        //tap和page的外容器对象
        this.pageList = {};         //保存打开的页面对象
        this.pageQueue = []; //保持页面打开的顺序队列
        this.activePage = false;//保存当前显示的页面信息，object
        this.showCallback = {}; //showPage后的回调函数，利用它可进行页面后加载操作
        this.inTabScroll = false;
        this.hideType = options.hideType;
        this.tmpl['tab'] = tabHtmlTmpl;
        this.tmpl['page'] = this.hideType == "display" ? pageHtmlTmpl : pageHtmlTmpl.replace('{{content}}','<div class="'+className.pageInner+'" style="position:relative;height:100%;">{{content}}</div>');
        this.tmpl['tabScroll'] = tabScrollHtml;
        //this.prefix=options.prefix;

        this.container['tab'] = $(options.tabContainer);
        this.container['page'] = $(options.pageContainer);

        this.tagNamePage = !this.tagNamePage && this.container['page'][0].tagName.toLowerCase() == 'ul' || this.container['page'][0].tagName.toLowerCase == 'ol' ? 'li' : 'div';
        this.tagNameTab = !this.tagNameTab && this.container['tab'][0].tagName.toLowerCase() == 'ul' || this.container['tab'][0].tagName.toLowerCase == 'ol' ? 'li' : 'div';

        this.tmpl['tabScroll'] = this.tmpl['tabScroll'].replace(/{{tag}}/g, this.container['tab'][0].tagName.toLowerCase());

        this.tabMarginH = '';
        this.tabWidthInfo = TabPage.prototype.getTabWidthInfo.call(this);

        //bind event
        this.container['tab'].delegate('.' + className.tab, 'mousedown', function (e) {
            if ($(this).hasClass('tab-active')) { return false; }
            if (e.which == 1) {
                TabPage.prototype.showPage.call(_self, $(this).data('id'));
            }
        })
        //bind event
        this.container['tab'].delegate('.' + className.close, 'mousedown', function () {
            return false;
        }).delegate('.' + className.close, 'click', function () {
            TabPage.prototype.close.call(_self, $(this).parents('.' + className.tab).eq(0).data('id'));
            return false;
        }).delegate('.' + className.close, 'mouseenter', function () {
            $(this).addClass(className.closeHover);
        }).delegate('.' + className.close, 'mouseleave', function () {
            $(this).removeClass('tab-close-hover');
        })

    }

    /**
   * 打开页面
   *  @param {options} Object 新页面配置对象
   *  @options.id    String 打开新页面的id标识，必填
   *  @options.url   String 打开新页面的地址，必填
   *  @options.title  String 打开新页面标题，在tab上显示，必填
   *  @options.icon  String 打开新页面图标class，在tab上显示，必填
   *  @options.type String 打开新页面的方式，可选"iframe"、"ajax"、和“html” 默认是iframe，当url不存在时默认为html
   *  @options.newWinodw Boolean 是否在新窗口打开页面
   *  @options.reload Boolean 是否刷新页面，当options.newWinodw为‘false’时起效
   *  @options.data  String|Object 在页面请求时附加数据
   *  @options.isFixed  Boolean 页面是否固定页面（页面不被closeAll方法删除，不显示关闭按钮）
   *  @options.lazyLoad Boolean 是否延迟加载页面，当为true是，open不显示页面，当调用showPage方法再加载
   *  @options.storage  [Number,String,Boolean,Object,Array] 保存的附加数据
   *  @options.fillCallback  [Function] 
   *  @options.showCallback  [Function] 
   *  @options.closeCallback  [Function] 
   *  @options.closeBefore  [Function] 返回true,表示执行关闭 false不执行关闭，如果使用ajax，请设置为同步
   *  @return false 表示打开不成功，超出数量限制
   */
    TabPage.prototype.open = function (options) {//[id,url,title,data,type,newWinodw,reload,lazyLoad,isFixed,storage,fillCallback,closeCallback,closeBefore]
        if (!TabPage.defaults) { alert("TabPage对象出错"); return false; }
        var options = $.extend({}, TabPage.defaults, options);
        var _self = this, addObj = {}, showContent = "", oldPage, id;

        if (options.newWinodw || !_self.isExist(options.id)) {//采用新窗口方式打开 或者 页面id还未存在时 统一打开新窗口

            //限制数量
            if (this.options.maxNum != "auto" && this.pageQueue.length + 1 > parseInt(this.options.maxNum, 10)) {
                return false;
            }

            //当没有url时 把type设为html
            if (!options.url) {
                options.type = "html";
            }

            if (options.type == "iframe") {
                showContent = '<iframe style="width:100%;visibility:hidden;" frameborder="no" height="100%"  allowTransparency="true" scrolling="yes"></iframe>';
            }

            if (this.getPageById(options.id)) {
                id = options.id + '-' + this.index;
            } else {
                id = options.id;
            }

            //处理tab宽度
            var $tabs = this.container['tab'].find('.' + className.tab);
            var minWidth = parseInt(this.options.minWidth, 10);
            var widthInfo = this.getTabWidthInfo();
            if (widthInfo['1'] < widthInfo['0']) {
                if (widthInfo['1'] < minWidth) {
                    if (!this.inTabScroll) {
                        addTabArrow.call(this, $tabs, minWidth);
                    }
                    this.container['tab'].find('.' + className.tabScrollContent).width(($tabs.length + 1) * minWidth + (this.tabMarginH < 0 ? $tabs.length * this.tabMarginH : ($tabs.length+1) * this.tabMarginH));
                    this.tabScrollObj.goEnd();
                } else {
                    if (onAnimate) {
                        $tabs.animate({ 'width': widthInfo['1'] + 'px' }, 300);
                    } else {
                        $tabs.css({ 'width': widthInfo['1'] + 'px' });
                    }
                }
            }
            this.tabWidthInfo = widthInfo;

            //set old tab
            if (this.activePage) {
                this.activePage.container['tab'].removeClass(options.activeClass);
                if (this.hideType == "display") {
                    this.activePage.container['page'].hide();
                } else {
                    this.activePage.container['page'].css({ 'visibility': 'hidden', 'zIndex': '0', 'textIndent': '-10000px' });
                    this.activePage.container['page'].find('.' + className.pageInner).css('left', '-10000px');
                }
            }

            //add new tab
            if (options.isFixed) {
                var tabClassName = "tab-fixed";
                var closeBtn = '';
            } else {
                var tabClassName = "";
                var closeBtn = tabCloseHtml;
            }
            if (options.icon) {
                tabClassName = tabClassName + ' show-icon';
            }

            var iconHtml = options.icon ? '<i class="tab-icon ' + options.icon + '"></i>' : '';
            var tabHtml = this.tmpl['tab'].replace('{{id}}', id).replace(/{{title}}/g, options.title).replace('{{class}}', tabClassName).replace('{{closeBtn}}', closeBtn).replace('{{icon}}', iconHtml).replace(/{{tag}}/g, this.tagNameTab);;
            if (this.inTabScroll) {
                addObj.tab = $(tabHtml).appendTo(this.container['tab'].find('.' + className.tabScrollContent))
            } else {
                addObj.tab = $(tabHtml).appendTo(this.container['tab'])
            }
            addObj.tab.addClass(this.options.activeClass).hide().css({ 'zIndex': options.startIndex + this.index * options.indexDiffer, 'position': 'relative', 'width': this.tabWidthInfo['1'] < minWidth ? minWidth : this.tabWidthInfo['1'] });
            addObj.tab.data('id', id);
            addObj.id = id;

            //add new page
            var pageHtml = this.tmpl['page'].replace('{{id}}', id).replace('{{content}}', showContent).replace(/{{tag}}/g, this.tagNamePage);
            addObj.page = $(pageHtml).appendTo(this.container['page']).css({ 'position': 'absolute','height':'100%' });

            this.pageList[id] = this.activePage = { 'id': id, 'title': options.title, 'container': { 'tab': addObj.tab, 'page': addObj.page }, 'type': options.type, 'url': options.url, 'html': options.html, 'data': options.data, 'index': this.index++, "storage": options.storage, 'fixed': options.isFixed ? true : false, loaded: options.lazyLoad ? false : true, "fillCallback": options.fillCallback, "showCallback": options.showCallback, "closeCallback": options.closeCallback ,'closeBefore':options.closeBefore};


            pageQueueAdd(this.pageQueue, id);

            //animate
            TabPage.openAnimate.call(this, addObj, function () {
                if (!options.lazyLoad) {
                    setPageContent(addObj.page, _self.pageList[id]);
                }
            })

        }
        else {
            if (options.reload) {
                _self.showPage(options.id);
                setPageContent(_self.pageList[options.id].container['page'], _self.pageList[options.id]);

            } else {
                _self.showPage(options.id);
            }
        }

    }

    /**
    * 打开页面
    *  @param {options} Object 新页面配置对象
    *  @options.id    String 打开新页面的id标识，必填
    *  @options.url   String 打开新页面的地址，必填
    *  @options.title  String 打开新页面标题，在tab上显示，必填
    *  @options.type String 打开新页面的方式，可选"iframe"，"ajax"，“html” 默认是iframe
    *  @options.newWinodw Boolean 是否在新窗口打开页面
    *  @options.reload Boolean 是否刷新页面，当options.newWinodw为‘false’时起效
    *  @options.data  String|Object 在页面请求时附加数据
    */
    TabPage.prototype.openPageList = function (PagesOptions, showIndex) {//[id,url,title,data,type,newWinodw,reload,show]
        var _self = this;
        if ($.isArray(PagesOptions)) {
            $.each(PagesOptions, function (i, n) {
                _self.open(n);
            })
        }
    }

    /**
	* 关闭指定id标签页，页面关闭后会自动触发showPage方法
    *  @param {id}   String 需要关闭页面的id标识，必填
    * runCloseCallback 是否执行页面关闭回调函数，默认为true
	*  @return boolean,true 表示关闭成功 false表示没有需要关闭的页面
	*/
    TabPage.prototype.close = function (id,runCloseCallback) {//[id]

        var type = typeof id, index, container, _self = this,isClose=true, runCloseCallback = runCloseCallback === undefined ? true : runCloseCallback;
        if (typeof this.pageList[id].closeBefore == "function") {
            isClose = this.pageList[id].closeBefore.call(this, this.pageList[id]);
        }

        if (isClose&&(type == "string" || type == "number")) {
            if (this.pageList[id]) {
                index = this.pageList[id].index;
                container = this.pageList[id].container;

                //执行关闭动画
                TabPage.closeAnimate.call(this, container, function () {

                    container['tab'].remove();
                    container['page'].remove();

                    //处理tab宽度
                    var $tabs = _self.container['tab'].find('.' + className.tab);
                    var minWidth = parseInt(_self.options.minWidth, 10);
                    var widthInfo = _self.getTabWidthInfo();

                    if (widthInfo['0'] > widthInfo['1']) {
                        if (widthInfo['0'] > minWidth) {
                            if (_self.inTabScroll) {
                                removeTabArrow.call(_self, $tabs, widthInfo)
                            } else {
                                if (onUpdate) {
                                    if (onAnimate) {
                                        $tabs.animate({ 'width': widthInfo['0'] + 'px' }, 300);
                                    } else {
                                        $tabs.css({ 'width': widthInfo['0'] + 'px' });
                                    }
                                }
                            }
                        } else {
                            _self.container['tab'].find('.' + className.tabScrollContent).width($tabs.length * minWidth + (_self.tabMarginH<0?($tabs.length - 2) * _self.tabMarginH:($tabs.length - 1) * _self.tabMarginH));
                            if (_self.tabScrollObj.getEndLeft() > _self.tabScrollObj.getCurrentLeft()) {
                                _self.tabScrollObj.goEnd();
                            }
                        }
                    }
                    _self.tabWidthInfo = widthInfo;
                    

                })

                if (runCloseCallback && typeof this.pageList[id].closeCallback == "function") {
                    this.pageList[id].closeCallback.call(this, this.pageList[id]);
                }

                pageQueueRemove(this.pageQueue, id);

                if (container['tab'].hasClass(this.options.activeClass)) {
                    var prevId = this.pageQueue[0];
                    if (prevId) {
                        this.showPage(prevId, false);
                    }
                }

                delete this.pageList[id];


                return true;
            } else {
                return false;
            }
        }
        else {
            return false;
        }

    }

    /**
   * 关闭指定标签页
   *  @param {idArray}   Array 需要关闭页面的id标识组成的数组，必填
   * callback,[function]关闭全部后执行的回调方法
   * runCloseCallback [boolean|object],是否执行页面的回调函数(closeCallback),可以通过布尔值全局设置，或者通过对象配置，如{"page1":false,"page2":true},page1/page2为页面id标识
   *  @return boolean,true 表示关闭所有页面 false表示没有需要关闭的页面
   */
    TabPage.prototype.closePageList = function (idArray, callback, runCloseCallback) {
        var _self = this, hasCLose = false;
        onUpdate = false, runClose=true;

        if (arguments.length == 2) {
            switch ($.type(callback)) {
                case "function":
                    callback.call(this, idArray);
                    break;
                case "boolean":
                case "object":
                    runClose = callback;
                    break;
            }
        } else if (arguments.length == 3) {
            callback.call(this,idArray);
            runClose = runCloseCallback === undefined ? true : runCloseCallback;
        }

        $.each(idArray, function (i, n) {
            if (runClose[n]) {
                _self.close(n);
            } else {
                _self.close(n, runClose);
            }
            hasCLose = true;
        })
        var widthInfo = _self.getTabWidthInfo();
        _self.container['tab'].find('.' + className.tab).stop().animate({ 'width': widthInfo['0'] + 'px' });
        onUpdate = true;
        return hasCLose;
    }


    /**
	* 关闭所有标签页
	* callback,[function]关闭全部后执行的回调方法
	* runCloseCallback [boolean|object],是否执行页面的回调函数(closeCallback),可以通过布尔值全局设置，或者通过对象配置，如{"page1":false,"page2":true},page1/page2为页面id标识
	*  @return boolean,true 表示关闭所有页面 false表示没有需要关闭的页面
	*/
    TabPage.prototype.closeAll = function (callback,runCloseCallback) {
        var _self = this, hasCLose = false;

        var closeList = [], callback = callback, runCloseCallback = runCloseCallback;

        $.each(this.pageList, function (i, n) {
            if (!n.fixed) {
                closeList.push(n.id)
            }
        })
        if (closeList.length) {
            if (arguments.length == 0) {
                hasCLose = _self.closePageList(closeList);
            } else {
                hasCLose = _self.closePageList(closeList, callback, runCloseCallback);
            }
        }

        return hasCLose;
    }

    /**
    * 把指定的页面显示
    *  @param {id} String 要显示页面的id标识符
    *  @return pageData|false ，当页面显示成功返回页面对象，否则返回false
    */
    TabPage.prototype.showPage = function (id) {

        if (typeof id != "undefined" && id != this.activePage.id) {

            var pageData = this.getPageById(id);
            if (typeof pageData == "undefined") { return false; }

            pageQueueAdd(this.pageQueue, id);

            //设置tab标签
            pageData.container['tab'].addClass(this.options.activeClass);



            //隐藏其他页面
            this.activePage.container['tab'].removeClass(this.options.activeClass);
            if (this.hideType == "display") {
                this.activePage.container['page'].hide();
            } else {
                this.activePage.container['page'].css({ 'visibility': 'hidden', 'zIndex': '0', 'textIndent': '-10000px' });
                this.activePage.container['page'].find('.' + className.pageInner).css('left', '-10000px');
            }

            //展示页面
            if (!pageData.container['page'].length) {
                var pageHtml = this.tmpl['page'].replace('{{id}}', id).replace('{{content}}', '').replace(/{{tag}}/g, this.tagName);
                pageData.container['page'] = $(pageHtml).appendTo(this.container['page']);
            }
            else {
                if (this.hideType == "display") {
                    pageData.container['page'].show();
                } else {
                    pageData.container['page'].css({ 'visibility': 'visible', 'zIndex': '100', 'textIndent': '0px' });
                    pageData.container['page'].find('.' + className.pageInner).css('left', '0');
                }

            }
            this.activePage = pageData;

            if (this.inTabScroll) {
                this.adjustTabPosition();
            }
            
            if (!pageData.loaded) {
                setPageContent(pageData.container['page'], pageData);
            }

            if (typeof pageData.showCallback == "function") {
                var contents;
                if (pageData.type = "iframe") {
                    contents = pageData.container['page'].find('iframe').contents();
                } else {
                    contents = pageData.container['page'];
                }
                pageData.showCallback.call(contents, pageData);
            }
            return pageData;
        } else {
            return false;
        }

    }

    /**
    * 通过id标识符获取页面对象
    *  @param {id} String 页面的id标识符
    *  @return pageData|undefined ，如果页面队列中有存在此id，返回页面对象，否则返回undefined
    */
    TabPage.prototype.getPageById = function (id) {
        var pageData = this.pageList[id];
        return pageData;
    }

    /**
    * 通过下标标识符获取页面对象
    *  @param {Index} Number 页面的下标标识符
    *  @return pageData|undefined ，如果页面队列中有存在此下标，返回页面对象，否则返回undefined
    */
    TabPage.prototype.getPageByIndex = function (index) {
        var pageData;
        for (var i in this.pageList) {
            if (i.index == index) {
                pageData = i;
                break;
            }
        }
        return pageData;
    }

    /**
    * 附加数据处理
    *  @param {id} String 页面的id标识符
    *  @param {extraData} 待处理的数据
    *  @param {isMerge} 是否将数据进行合拼
    */
    TabPage.prototype.storage = function (id, extraData, isMerge) {
        var storage = this.pageList[id].storage;
        if (arguments.length == 1) {
            return storage;
        } else if (arguments.length == 3) {
            if (storage === undefined) {
                return this.pageList[id].storage = extraData;
            } else {
                //数据合拼
                switch (typeof storage) {
                    case "string":
                    case "number": {
                        this.pageList[id].storage += extraData; break;
                    }
                    case "object": {
                        if ($.isArray(storage)) {
                            Array.prototype.push.apply(storage, extraData)
                        } else {
                            $.extend(this.pageList[id].storage, extraData);
                        }
                    }
                }
                return this.pageList[id].storage;
            }
        } else {
            return this.pageList[id].storage = extraData;
        }
        
    }


    /**
    * 判断页面是否存在
    *  @param {id}  页面标识符
    *  @return Boolean ，true表示页面存在，false表示页面不存在
    */
    TabPage.prototype.isExist = function (id) {
        var idObj = {};
        var height = this.pageList.length;
        $.each(this.pageList, function () {
            idObj[this.id] = true;
        })
        if (idObj[id]) {
            return true;
        } else {
            return false;
        }
    }

    /**
    * 将已存在的页面添加到tabPage对象管理
    *  @param {pageData} Object 页面的下标标识符
    *  @pageData.tab String 添加的tab的css选择器，必填
    *  @pageData.page String 添加的page的css选择器，非必填，容器也可以不存在，程序会自动添加
    *  @pageData.id    String 添加的页面id标识，必填
    *  @pageData.title  String 添加的页面标题，必填
    *  @param {isfixed} boolean 表示页面为固定不可删除,true为不可删除，非必填
    */
    TabPage.prototype.includePage = function (pageData, isFixed) {//[tab,page,id,title],isfixed 
        var _this = this;
        if (pageData === undefined) { alert("请输入要引入的页面数据"); return false; }
        var container = {};
        container.tab = $(pageData.tab).addClass(className.tab).css({ 'zIndex': _this.options.startIndex + this.index * _this.options.indexDiffer, 'position': 'relative', 'width': this.tabWidthInfo['1'] });
        container.page = $(pageData.page).addClass(className.page);
        
        this.pageList[pageData.id] = this.activePage = { 'id': pageData.id, 'title': pageData.title, 'type': pageData.type ? "pageData.type" : "html", 'url': pageData.url, 'data': pageData.data, 'index': this.index++, 'container': container, "storage": pageData.storage, 'fixed': isFixed ? true : false };

        if (!container.tab.parents(this.options.tabContainer).length) {
            container.tab.find('.' + className.close).bind('mousedown', function () {
                return false;
            }).bind('click', function () {
                _this.close($(this).parents('.' + className.tab).eq(0).data('id'));
                return false;
            }).bind('mouseenter', function () {
                $(this).addClass(className.closeHover);
            }).bind('mouseleave', function () {
                $(this).removeClass(className.closeHover);
            })
            container.tab.bind('mousedown', function (e) {
                if ($(this).hasClass('tab-active')) { return false; }
                if (e.which == 1) {
                    _this.showPage($(this).data('id'));
                }
            })
        }



        pageQueueAdd(this.pageQueue, pageData.id)

        container.tab.data({ "id": pageData.id })
    }

    /**
    * 获取Tab的宽度信息，包括去掉一个tab时的宽度、当前的宽度、增加一个tab时的宽度
    *  @return Object { "-1": tabMinusWidth, "0": tabCurrentWidth, "1": tabAddWidth }
    */
    TabPage.prototype.getTabWidthInfo = function () {
        var maxWidth = parseInt(this.options['maxWidth'], 10),
              tabWrapWidth = this.container['tab'][0].offsetWidth,
              $tabs = this.container['tab'].find('.' + className.tab),
              tabNums = $tabs.length,
              tabCurrentWidth, tabMinusWidth, tabAddWidth;


        if (this.tabMarginH == '') {
            if (!tabNums) {
                var tabHtml = this.tmpl['tab'].replace('{{id}}', "test").replace('{{title}}', "test").replace('{{class}}', className.tab).replace('{{closeBtn}}', '').replace('{{icon}}', '').replace(/{{tag}}/g, this.tagNameTab);
                testTab = $(tabHtml).appendTo(this.container['tab']).hide();
                var tabMarginL = parseInt(testTab.css('marginLeft'), 10);
                var tabMarginR = parseInt(testTab.css('marginRight'), 10);
                tabMarginL = this.tabMarginL = tabMarginL ? tabMarginL : 0;
                tabMarginR = this.tabMarginR = tabMarginR ? tabMarginR : 0;
                this.tabMarginH = tabMarginL + tabMarginR;
                testTab.remove();
            } else {
                var tabMarginL = parseInt($tabs.eq(0).css('marginLeft'), 10);
                var tabMarginR = parseInt($tabs.eq(0).css('marginRight'), 10);
                tabMarginL = this.tabMarginL = tabMarginL ? tabMarginL : 0;
                tabMarginR = this.tabMarginR = tabMarginR ? tabMarginR : 0;
                this.tabMarginH = tabMarginL + tabMarginR;
            }
            
        }
        maxWidth + this.tabMarginH;
        if (this.tabMarginH < 0) {
            tabWrapWidth -= this.tabMarginH * (tabNums-1);
        } else {
            tabWrapWidth -= this.tabMarginH * tabNums;
        }

        //当前的宽度
        if (tabNums * maxWidth > tabWrapWidth) {
            tabCurrentWidth = tabWrapWidth / tabNums;
        } else {
            tabCurrentWidth = maxWidth;
        }

        //减去一个tab后各个tab的宽度
        var tabWrapMinusWidth = tabWrapWidth + this.tabMarginH;
        if ((tabNums - 1) * maxWidth > tabWrapMinusWidth) {
            tabMinusWidth = tabWrapMinusWidth / (tabNums - 1);
        } else {
            tabMinusWidth = maxWidth;
        }

        //增加一个tab后各个tab的宽度
        var tabWrapAddWidth = tabWrapWidth -this.tabMarginH;
        if ((tabNums + 1) * maxWidth > tabWrapAddWidth) {
            tabAddWidth = tabWrapAddWidth / (tabNums + 1);
        } else {
            tabAddWidth = maxWidth;
        }

        return { "-1": tabMinusWidth, "0": tabCurrentWidth, "1": tabAddWidth }
    }

    /**
    * 调整tab的宽度，当tab外容器宽度改变时，调用此方法，来更新tab的宽度
    * @return Boolean ，true表示调整成功，false表示不需要调整
    */
    TabPage.prototype.adjustTabSize = function () {
        var widthInfo = this.getTabWidthInfo();
        if (this.tabWidthInfo['0'] != widthInfo['0']) {
            var minWidth = parseInt(this.options['minWidth'], 10),
                minWidth = minWidth ? minWidth : 0;
            $tabs = this.container['tab'].find('.' + className.tab);

            if ($tabs.is(":animated")) { $tabs.stop(); }

            //出现左右箭头
            if (!this.inTabScroll) {
                if (widthInfo['0'] < minWidth) {
                    addTabArrow.call(this, $tabs, minWidth)
                    return true;
                } else {
                    $tabs.css('width', widthInfo['0'] + 'px')
                    this.tabWidthInfo = widthInfo;
                    return true;
                }

            } else {
                if (widthInfo['0'] > minWidth) {
                    removeTabArrow.call(this, $tabs, widthInfo)
                    //$(this.tmpl['tabScroll']).appendTo(this.container['tab']).find('.' + className.tabScrollContent).append($tabs);
                } else {
                    this.adjustTabPosition();
                    return false;
                }
            }

        } else {
            return false;
        }


    }

    /**
    * 调整tab的位置，当出现左右滚动条时才起效
    * @return Boolean ，true表示调整成功，false表示不需要调整
    */
    TabPage.prototype.adjustTabPosition = function () {
        if (this.inTabScroll) {
            var $activeTabItem = this.activePage.container['tab'];
            var currentScrollLeft = this.tabScrollObj.getCurrentLeft();
            var tabLeft = $activeTabItem[0].offsetLeft;
            var tabWidth = $activeTabItem[0].offsetWidth;
            var tabScrollObj = this.tabScrollObj;
            var tabViewWidth = tabScrollObj.viewContent[0].offsetWidth;
            var endLeft = tabScrollObj.getEndLeft();

            if (currentScrollLeft < endLeft) {
                tabScrollObj.goEnd()
                return true;
            } else {

                if (Math.abs(currentScrollLeft) > tabLeft) {
                    tabScrollObj.go(-tabLeft);
                    return true;
                }
                else {
                    var maxViewWidth = tabViewWidth + Math.abs(currentScrollLeft);
                    var currentViewWdith = tabLeft + tabWidth;
                    if (maxViewWidth < currentViewWdith) {
                        tabScrollObj.go(tabViewWidth - currentViewWdith);
                        return true;
                    }

                }
            }
            return false;
        } else {
            return false;
        }
    }

    //私有方法  增加tab左右箭头
    function addTabArrow($tabs, minWidth) {
        var _self = this;
        var tabNum = $tabs.length;
        count = 0;
        $(this.tmpl['tabScroll']).appendTo(this.container['tab']).find('.' + className.tabScrollContent).append($tabs).width($tabs.length * minWidth + (this.tabMarginH<0?($tabs.length - 1) *this.tabMarginH:$tabs.length*this.tabMarginH) );
        $tabs.animate({ 'width': minWidth + 'px' }, function () {
            count++;
            if (count == tabNum) {
                _self.adjustTabPosition();
            }
        });

        //管理tab左右移动对象
        this.tabScrollObj = {
            viewContent: _self.container['tab'].find('.' + className.tabScrollView),
            scrollContent: _self.container['tab'].find('.' + className.tabScrollContent).css({ 'position': 'absolute' }),
            btnPrev: this.container['tab'].find('.' + className.tabScrollPrev),
            btnNext: this.container['tab'].find('.' + className.tabScrollNext),
            isTop: false,
            isEnd: false,
            goTop: function () {
                this.go(0, 300);
            },
            goEnd: function () {
                this.go(this.getEndLeft(), 300);
            },
            go: function (distance, speed) {
                if (speed === undefined) { var speed = 300; }
                if (distance == 0) {
                    this.btnPrev.addClass('disable');
                    this.btnNext.removeClass('disable');
                    this.isTop = true;
                    this.isEnd = false;
                } else if (distance == this.getEndLeft()) {
                    this.btnPrev.removeClass('disable');
                    this.btnNext.addClass('disable');
                    this.isTop = false;
                    this.isEnd = true;
                } else {
                    this.btnPrev.removeClass('disable');
                    this.btnNext.removeClass('disable');
                    this.isTop = false;
                    this.isEnd = false;
                }
                this.scrollContent.stop(true, true).animate({ 'left': distance + 'px' }, speed);
            },
            prev: function () {
                var currentLeft = this.getCurrentLeft();
                var left = currentLeft + minWidth;
                (left > 0 || left > -minWidth) ? this.go(0) : this.go(left);
            },
            next: function () {
                var currentLeft = this.getCurrentLeft();
                var left = currentLeft - minWidth;
                var endLeft = this.getEndLeft();
                (left < endLeft || left - minWidth < endLeft) ? this.go(endLeft) : this.go(left);
            },
            getEndLeft: function () {
                var viewWidth = this.viewContent[0].offsetWidth;
                var scrollWidth = this.scrollContent[0].offsetWidth;
                return viewWidth - scrollWidth;
            },
            getCurrentLeft: function () {
                var currentLeft = parseInt(this.scrollContent.css('left'), 10);
                return currentLeft ? currentLeft : 0;
            }
        }

        this.container['tab'].find('.' + className.tabScrollPrev).bind('click', function () {
            _self.tabScrollObj.prev();

        }).bind('mouseenter', function () {
            $(this).addClass('hover');
        }).bind('mouseleave', function () {
            $(this).removeClass('hover');
        })

        this.container['tab'].find('.' + className.tabScrollNext).bind('click', function () {
            _self.tabScrollObj.next();
        }).bind('mouseenter', function () {
            $(this).addClass('hover');
        }).bind('mouseleave', function () {
            $(this).removeClass('hover');
        })

        this.inTabScroll = true;
    }

    //私有方法  移除tab左右箭头
    function removeTabArrow($tabs, widthInfo) {
        this.container['tab'].append($tabs).find('.' + className.tabScroll).remove();
        if (onUpdate) {
            if (onAnimate) {
                $tabs.stop().animate({ 'width': widthInfo['0'] + 'px' });
            } else {
                $tabs.css({ 'width': widthInfo['0'] + 'px' });
            }
        }
        this.tabScrollObj = null;
        this.inTabScroll = false;
    }

    //私有方法 设置page页面内容
    function setPageContent(pageObj, pageData) {
        if (pageData.type == "iframe") {
            var url = pageData.url;
            if (typeof pageData.data != "undefined") {
                if (url.indexOf('?') == -1) {
                    url = url + '?' + $.param(pageData.data)
                } else {
                    url = url + '&' + $.param(pageData.data)
                }
            }
            pageObj.find('iframe').attr('src', url).css('visibility', 'visible');
            pageData.loaded = true;
        } else if (pageData.type == "ajax") {
            $.ajax({
                url: url,
                data: typeof pageData.data != "undefined" ? pageData.data : '',
                success: function (html) {
                    pageObj.html(html);
                    pageData.loaded = true;
                }
            })
        } else if (pageData.type == "html") {
            pageObj.html(pageData.html);
            pageData.loaded = true;
        }
        if (typeof pageData.fillCallback == "function") {
            var contents;
            if (pageData.type = "iframe") {
                contents = pageData.container['page'].find('iframe').contents();
            } else {
                contents = pageData.container['page'];
            }
            pageData.fillCallback.call(contents, pageData);
        }
    }

    //私有方法 向页面队列对象中添加数据
    function pageQueueAdd(array, id) {//将参数id添加到array里，假如已存在 就将它放到最尾部,直接在array上修改
        var listArray = array,
              listNum = listArray.length,
              isExist = false;

        for (var i = listNum; i--;) {
            if (listArray[i] == id) {
                listArray.splice(i, 1);
                listArray.unshift(id);
                isExist = true;
                return listArray;
            }
        }

        if (!isExist) {
            listArray.unshift(id);
            return listArray;
        }
    }

    //私有方法 向页面队列对象中移除数据
    function pageQueueRemove(array, id) {

        var listArray = array,
              listNum = listArray.length,
              isExist = false;

        for (var i = listNum; i--;) {
            if (listArray[i] == id) {
                listArray.splice(i, 1);
                isExist = true;
                return listArray;
            }
        }

        if (!isExist) {
            return false;
        }
    }

    //静态方法 打开tab页的动画，可重写。最后必须要调用renderPage函数来渲染页面
    TabPage.openAnimate = function (addObj, renderPage) {
        //this 指向tabpage对象
        //addObj.tab 新添加页面的tab容器对象(jQUery)
        //addObj.page 新添加页面的page容器对象(jQUery)
        //addObj.id  新添加的页面标识(string)
        var pageWidth = this.container['page'][0].offsetWidth,
              pageHeight = this.container['page'][0].offsetHeight,
              _this = this;
        if (ie && ie <= 6) {
            addObj.page.css({ 'width': '86%', 'height': '86%', 'marginTop': '7%', 'marginLeft': '7%' });
            addObj.page.animate({ 'width': '100%', 'height': '100%', 'marginTop': '0%', 'marginLeft': '0%' }, 200, function () {
                addObj.tab.css('top', '38px').show().animate({ 'top': '0px' }, 400, function () {
                    renderPage();
                });
            })
        } else {
            addObj.page.css({ 'top': '14%', 'right': '14%', 'bottom': '14%', 'left': '14%' });
            addObj.page.animate({ 'top': '0%', 'right': '0%', 'bottom': '0%', 'left': '0%' }, 200, function () {
                addObj.tab.css({ 'top': '38px' }).show().animate({ 'top': '0px' }, 400, function () {
                    renderPage();
                });
            });
        }
    }

    //静态方法 关闭tab页的动画
    TabPage.closeAnimate = function (removeObj, removePage) {
        removePage();
    }

    TabPage.defaults = {
        type: 'iframe',//iframe|ajax|html
        maxWidth: '150',//tabz最大宽度，默认打开的宽度,单位px
        minWidth: '100',//tabz最小宽度，当小于最小宽度时，tab不再缩小，出现左右按钮，单位px
        maxNum: 'auto',//最多打开的tabpage数量，auto为不限制
        newWinodw: false,//当id存在时，是否在新窗口打开
        showNow: true,//打开页面同时加载数据
        reload: false,//当页面id存在时是否刷新页面，当window为old时起效
        icon: false,//默认的图标class名，false不显示图标
        activeClass: 'tab-active',//当前tab的class名
        startIndex: 200,//tab的开始z-index
        indexDiffer: 1,//tab之间的差量，正数为递增，负数为递减
        hideType: 'visibility'//隐藏标签页的方式[visibility,display],在页面显示前要获取盒子大小时使用visibility，否侧使用display
    }


})(window, jQuery)



