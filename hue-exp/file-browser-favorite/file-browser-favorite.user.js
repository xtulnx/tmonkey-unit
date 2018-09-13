// ==UserScript==
// @name         Hue file-browser favorite
// @namespace    https://github.com/xtulnx/tmonkey-unit
// @version      0.2.20180914.bata
// @description  Hue 文件浏览器的自定义收藏夹
// @author       jason.liao
// @match        http://*/filebrowser/view=*
// @grant        GM_getValue
// @grant        GM_log
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @==run-at       document-start
// ==/UserScript==


(function (module, context) {
    'use strict';

    // 样式，可以根据喜好自行调整
    GM_addStyle('\
.jarFavList li {font-size:13px;display:inline;} \
.jarFavList:hover { border-bottom: 2px solid #338bb8; } \
.jarFavList a {text-decoration: none; } \
.jarFavList.no-jarFavList:hover { border-bottom: 2px solid transparent; } \
.jarFavList.no-jarFavList a { color: #ccc; cursor: default; } \
.jarFavList > .dropdown-menu { left: inherit; right: 0; } \
#jarFavHistoryList .divider {display:block;}\
#jarFavHistoryList a:hover { color: red; outline: 0; border-bottom: 1px solid #338bb8; }\
#jarFavorite{margin: 0 0 0 0; margin: 0 0 0 0;}\
.jarFavMark .hasMark{color:tomato} .jarFavMark .unMark{color:blue}\
ul.jarFavDir > li:last-child > a {  font-weight: bold;  color: #333333;}\
ul.jarFavDir > li:last-child > a:hover{ color: red;}\
ul.jarFavDir:hover{ background-color: #F0F0F0;}\
ul.jarFavDir{margin: 2px 3px 2px 8px; padding: 2px 8px 2px 8px; } \
ul.jarFavDir span {  color:gray; /*text-decoration: underline dotted coral; */}\
ul.jarFavDir span,ul.jarFavDir li {  margin-right:4px; } \
.jarFavTool {float:left;position:relative;left:20px;top:0px;display:inline;} \
.jarFavTool a {padding-left:4px !important;padding-right:4px !important;display:inline-block !important;} \
');

    // [辅助] 日期简单格式化
    function jarKit_dateFormat(d, fmt) {
        var o = {
            "M+": d.getMonth() + 1, //月份
            "d+": d.getDate(), //日
            "h+": d.getHours(), //小时
            "m+": d.getMinutes(), //分
            "s+": d.getSeconds(), //秒
            "q+": Math.floor((d.getMonth() + 3) / 3), //季度
            "S": d.getMilliseconds() //毫秒
        };
        if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (d.getFullYear() + "").substr(4 - RegExp.$1.length));
        for (var k in o)
            if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
        return fmt;
    }

    // [辅助] 提示语
    function jarKit_toast(msg) {
        // TODO: 待实现
    }

    if (typeof viewModel === 'undefined') {
        GM_log("not support");
        return;
    }

    // 加载，可以考虑使用 GM_getValue
    function jarHfLoad() {
        var a = apiHelper.getFromTotalStorage('fb', "jar_favorite", []);
        return (Array.isArray(a))?a.filter(x => x != null):[];
    }

    // 更新储存 或 可以换成 GM_setValue
    function jarHfSave(his) {
        apiHelper.setInTotalStorage('fb', "jar_favorite", his || []);
    }

    // 分隔子路径
    // _blk 用于忽略已经引用过的子路径，如果需要保留，这里不传入
    function jarKit_breadcrumb(p, pre, level, blk) {
        var i1 = (pre || '').length;
        var bl = blk || {}, isFirst = true;
        var html = '<ul class="jarFavDir">';
        do {
            var i1_ = i1;
            var i2 = p.indexOf('/', i1_ + 1);
            if (i2 < 0) i2 = p.length;
            i1 = i2;
            var s1 = p.substr(i1_, i2 - i1_);
            if (s1 == '' || s1 == '/') continue;
            var _url = p.substr(0, i2);
            if (blk[_url]) continue;
            if (isFirst && i1_ > 1) html += '<span>' + p.substr(0, i1_) + '</span>';
            html += '<li><a href="#' + _url + '">' + s1 + '</a></li>';
            blk[_url] = true;
            isFirst = false;
        } while (i1 < p.length);
        return html + '</ul>';
    }

    // 展示收藏夹
    function jarHfShow() {
        var history = jarHfLoad().sort();
        var frag = $('<ul/>', {
            'id': 'jarFavHistoryList',
            'class': 'dropdown-menu',
            'role': 'menu',
            'aria-labelledby': 'historyDropdown'
        });
        $('#jarFavHistoryList').remove();
        if (history.length === 0) {
            $('.jarFavList').addClass('no-jarFavList');
        }
        $('.jarFavList').removeClass('no-jarFavList');

        //  history.forEach(item => $('<li><a href="' + '#' + item + '">' + item + '</a></li>').appendTo(frag););
        var _st = [], _sn = 0, _sl = "", _blk = {};
        history.forEach(p => {
            while(_st.length > 0 && !p.startsWith(_sl)) _sl = _st.pop();
            $('<li>' + jarKit_breadcrumb(p, '', _st.length, _blk) + '</li>').appendTo(frag);
            _sl = p + (p.endsWith('/') ? '' : '/');
            _st.push(_sl);
        });

        $('<li>', {'class': 'divider'}).appendTo(frag);

        $('<li><a href="javascript:void(0)">全部清除...</a></li>')
            .appendTo(frag)
            .on('click', function () {
                jarHfSave();
                jarHfRefresh();
                $('.jarFavList').addClass('no-jarFavList');
            });
        $(frag).appendTo('.jarFavList');
        return this;
    }

    // 更新状态
    function jarHfRefresh(path) {
        var his = jarHfLoad();
        var p = path || viewModel.currentPath();
        if (p.endsWith('/')) p = p.substr(0, p.length - 1);
        var match = his.indexOf(p) >= 0;
        $('.jarFavMark > i').removeClass().addClass(match ? 'hasMark fa fa-star' : 'unMark fa fa-star-o');
    }

    // 更改路径标记
    function jarHfMark(path, mark) {
        var p = path || viewModel.currentPath();
        if (p.endsWith('/')) p = p.substr(0, p.length - 1);
        var his = jarHfLoad();
        var idx = his.indexOf(p);
        if (mark == undefined) mark = idx < 0;
        if (mark == idx < 0) {
            if (idx < 0) his.unshift(p); else his = his.filter(x => x != p);//.splice(idx,1);
            jarHfSave(his);
        }
        jarHfRefresh();
    }

    // 复制节点的路径，只用于
    function kitCopyPath(e) {
        GM_setClipboard($(this).data('url'), "text");
        e.preventDefault();
        e.stopPropagation();
    }

    // 在路径中添加收藏夹功能
    $('.actionbar-main').prepend(
        $('\
<div class="pull-right"><ul id="jarFavorite" class="hueBreadcrumb">\
  <li><div class="dropdown jarFavList">\
      <a href="javascript:void(0)" class="jarFavLink dropdown-toggle" \
         title="收藏夹" data-toggle="dropdown" id="jarFavDropdown">\
      <i class="fa fa-caret-down"></i> 收藏夹</a>\
  </div></li>\
</ul></div>\
'));

    $('#editBreadcrumb').parent().before($('<li class="jarFavTool">\
<a class="jarFavMark" href="javascript: void(0)" title="收藏夹"><i class="blue fa fa-star-o"></i></a>\
<a class="jarFavCopy" href="javascript: void(0)" title="复制路径"><i class="fa fa-copy"></i></a>\
</li>\
'));

    $(document).ready(function () {
        $('.jarFavMark').on('click', function (e) {
            jarHfMark();
        });
        $('.jarFavCopy').on('click', function (e) {
            var files = viewModel.selectedFiles(), d;
            if (files.length == 0) d = viewModel.currentPath();
            else d = files.map(p => p.path
        ).
            join('\n');
            GM_setClipboard(d, "text");
        });
        $('.jarFavLink').on('click', function (e) {
            jarHfShow();
        });
    });

    // 切换新目标路径
    /*     $(window).bind("hashchange",function(){
            var hash = window.location.hash.substring(1);
            if (hash.search(/(<([^>]+)>)/ig) > -1) {
                hash = encodeURI(hash);
            }
            if (hash!=null && hash!="") {
                GM_log("from: "+ viewModel.currentPath()+"\n\tto:"+hash);
                jarHfRefresh(hash);
            }
        }); */

    // 修改 文件列表
    $('<th width="1%">D</th>').insertBefore($("thead th:nth-child(3)"));
    var originalUpdateFileList = viewModel.updateFileList;
    viewModel.updateFileList = function () {

        // 重新格式化 "文件修改时间" ，需要时可以注释
        if (arguments.length > 0 && Array.isArray(arguments[0])) arguments[0].forEach(f => f.mtime = jarKit_dateFormat(new Date(f.mtime), 'yyyy/MM/dd hh:mm:ss'))

        originalUpdateFileList.apply(this, arguments);

        var files = viewModel.files();
        $("#files > tr > td:nth-child(3)").each(function (index) {
            var cell = $('<td/>').insertBefore(this);

            // 添加 "复制路径"
            if (index > 1)
                $('<a class="jarFavCopy" href="javascript: void(0)" data-url="' + files[index].path + '" title="复制路径""><i class="fa fa-copy"></i> </a>')
                    .appendTo(cell)
                    .on('click', kitCopyPath);

            // 添加 "直接下载"
            if (files[index].type == 'file')
                $('<a href="/filebrowser/download' + files[index].path + '" target="_blank"  title="直接下载"><i class="fa fa-arrow-circle-o-down"></i> </a>')
                    .appendTo(cell);
        });

        // 重新加载时刷新下是否已经收藏的标记
        jarHfRefresh();
    };
})();
