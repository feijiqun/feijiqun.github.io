//关键词sug
var hotList = 0;
$(function () {
    //当键盘键被松开时发送Ajax获取数据
    $('#search-text').keyup(function () {
        var keywords = $(this).val();
        if (keywords == '') {
            $('#word').hide();
            return
        }
        ;
        $.ajax({
            url: 'https://suggestion.baidu.com/su?wd=' + keywords,
            dataType: 'jsonp',
            jsonp: 'cb', //回调函数的参数名(键值)key
            // jsonpCallback: 'fun', //回调函数名(值) value
            beforeSend: function () {
                // $('#word').append('<li>正在加载。。。</li>');
            },
            success: function (res) {
                $('#word').empty().show();
                hotList = res.s.length;
                if (hotList) {
                    $("#word").css("display", "block");
                    for (var i = 0; i < hotList - 1; i++) {
                        if (i === hotList - 1) {
                            $("#word").append('<li id="lastHot"><span>' + (i + 1) + "</span>" + res.s[i] + "</li>");
                        } else {
                            $("#word").append("<li><span>" + (i + 1) + "</span>" + res.s[i] + "</li>");
                        }
                        $("#word li").eq(i).click(function () {
                            $('#search-text').val(this.childNodes[1].nodeValue);
                            window.open(thisSearch + this.childNodes[1].nodeValue);
                            $('#word').css('display', 'none')
                        });
                        if (i === 0) {
                            $("#word ul li").eq(i).css({
                                "border-top": "none"
                            });
                            $("#word ul span").eq(i).css({
                                "color": "#fff",
                                "background": "#f54545"
                            })
                        } else if (i === 1) {
                            $("#word ul span").eq(i).css({
                                "color": "#fff",
                                "background": "#ff8547"
                            })
                        } else if (i === 2) {
                            $("#word ul span").eq(i).css({
                                "color": "#fff",
                                "background": "#ffac38"
                            })
                        }
                    }
                } else {
                    $("#word").css("display", "none")
                }

                /*
                if (data.s == '') {
                    //$('#word').append('<div class="error">Not find  "' + keywords + '"</div>');
                    $('#word').empty();
                    $('#word').hide();
                }
                $.each(data.s, function() {
                    $('#word').append('<li>' + this + '</li>');
                })*/
            },
            error: function () {
                $('#word').empty().show();
                //$('#word').append('<div class="click_work">Fail "' + keywords + '"</div>');
                $('#word').hide();
            }
        })
    })

    //点击搜索数据复制给搜索框
    $(document).on('click', '#word li', function () {
        var word = $(this).text().replace(/^[0-9]/, '');
        $('#search-text').val(word);
        $('#word').empty();
        $('#word').hide();
        //$("form").submit();
        $('.submit').trigger('click');//触发搜索事件
    })
    //$(document).on('click', '.container,.banner-video,nav', function() {
    $(document).on('click', '.io-grey-mode', function () {
        $('#word').empty();
        $('#word').hide();
    })

});

//手机端底部 tab 栏（全站共享，样式见 custom-style.css 的 .m-tabbar）
(function () {
    var tabs = [
        {key: 'channel', href: '/', icon: 'fa-brands fa-telegram', text: '频道'},
        {key: 'group', href: '/group/', icon: 'fa-solid fa-user-group', text: '群组'},
        {key: 'robot', href: '/robot/', icon: 'fa-solid fa-robot', text: '机器人'},
        {key: 'enroll', href: '/enroll/', icon: 'fa-solid fa-circle-plus', text: '收录'},
        {key: 'about', href: '/about/', icon: 'fa-solid fa-circle-info', text: '关于'}
    ];

    function currentKey() {
        var path = location.pathname;
        if (/^\/group(\/|$)/.test(path)) return 'group';
        if (/^\/robot(\/|$)/.test(path)) return 'robot';
        if (/^\/enroll(\/|$)/.test(path)) return 'enroll';
        if (/^\/about(\/|$)/.test(path)) return 'about';
        if (/^\/detail\//.test(path)) {
            //详情页按所属分类（第一个分类按钮）高亮
            var cat = document.querySelector('.site-body .btn-cat');
            var href = cat ? cat.getAttribute('href') || '' : '';
            if (/^\/group/.test(href)) return 'group';
            if (/^\/robot/.test(href)) return 'robot';
            return 'channel';
        }
        if (path === '/' || /^\/(index\.html|p2|categories|tags)(\/|$)/.test(path)) return 'channel';
        return '';
    }

    //竖屏时让页面延伸到 iPhone 底部安全区，tab 栏再用 env(safe-area-inset-bottom) 让开
    function syncViewportFit() {
        var meta = document.querySelector('meta[name=viewport]');
        if (!meta) return;
        var content = meta.getAttribute('content').replace(/,\s*viewport-fit=\w+/, '');
        if (window.matchMedia('(orientation: portrait)').matches) content += ',viewport-fit=cover';
        meta.setAttribute('content', content);
    }

    function render() {
        if (document.querySelector('.m-tabbar')) return;
        var active = currentKey();
        var nav = document.createElement('nav');
        nav.className = 'm-tabbar';
        nav.setAttribute('aria-label', '底部导航');
        nav.innerHTML = tabs.map(function (t) {
            var on = t.key === active;
            return '<a class="m-tab' + (on ? ' is-current' : '') + '" href="' + t.href + '"' +
                (on ? ' aria-current="page"' : '') + '><i class="' + t.icon + '"></i><span>' + t.text + '</span></a>';
        }).join('');
        document.body.appendChild(nav);
        document.documentElement.classList.add('has-m-tabbar');
    }

    function init() {
        syncViewportFit();
        var portrait = window.matchMedia('(orientation: portrait)');
        if (portrait.addEventListener) portrait.addEventListener('change', syncViewportFit);
        render();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
