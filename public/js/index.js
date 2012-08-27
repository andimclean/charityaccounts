$(document).ready(function () {
    function AppViewModel() {
        var self = this;

        self.email = ko.observable("");
        self.navStatus = ko.observable("home");
        self.user = ko.observable(null);
        
        //behaviour
        self.go_to_home = function() { location.hash = "home" };
        self.go_to_about = function() { location.hash = "about" };
        self.go_to_contact = function() { location.hash = "contact" };
        self.isHome =  ko.computed(function(){
            return self.navStatus() == "home";
        });
        self.isAbout =  ko.computed(function(){
            return self.navStatus() == "about";
        });
        self.isContact =  ko.computed(function(){
            return self.navStatus() == "contact";
        });
        self.isUser = ko.computed(function(){
            return self.navStatus() == "user";
        });
        self.isLoggedIn = ko.computed(function(){
            var user = self.user(); 
            return user !== null;
        });
        self.name = ko.computed(function(){
            var user = self.user();
            return user ? user.name : "";
        });
        self.login = function() {
            jQuery.ajax( {
                url: "/api/login",
                data: { email: self.email()},
                success: function(data) {
                    alert("Success : " + data);
                },
                error: function(data) {
                    alert("Failure : " + data);
                },
                type: "post"
            })
            return false;
        }
        
        self.performLogin = function(token){
             jQuery.ajax( {
                url: "/api/loginConfirm",
                data: { token: token},
                success: function(data) {
                    self.user(data.obj);
                    self.go_to_home();
                },
                error: function(data) {
                    alert("Failure : " + data);
                },
                type: "post"
            })
            return false;
        }
        
        self.getTokenFromStorage = function() {
          return sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken') || "";  
        };
        
        self.setAjax = function() {
	        jQuery.ajaxSetup({
	            headers: {sessionToken: self.getTokenFromStorage()}
	        });
        };
        
        self.setTokenInStorage = function(sessionToken) {
            if (localStorage.getItem('persistent')) {
                localStorage.setItem('sessionToken', sessionToken);
            } else {
                sessionStorage.setItem('sessionToken', sessionToken);
            }
            self.setAjax();
        };
        
        self.loadUser = function() {
            jQuery.ajax({
                url: '/api/getUser',
                success: function(data){
                   self.user(data.obj);
                },
                error: function(jqXHR, textStatus, errorThrown){
                    if (jqXHR.status === 403) {
                        self.user(null);
                    } else {
                        alert(errorThrown);
                    }
                }
            });
        };
        
        self.performLogout = function() {
            jQuery.ajax({
                url: '/api/logout',
                success: function(data){
                   self.user(null);
                   self.go_to_home();
                },
                error: function(jqXHR, textStatus, errorThrown){
                    if (jqXHR.status === 403) {
                        self.user(null);
                        self.go_to_home();
                    } else {
                        alert(errorThrown);
                    }
                },
                type: 'post'
            });
        };
        //setup
        Sammy(function() {
            this.post('#login',function() {
                self.login();
                return false;
            });
            
            this.get('#home', function() {
                self.navStatus('home');
                jQuery('.sections').hide();
                jQuery('#home').show();
            });

            this.get('#about', function() {
                self.navStatus('about');
                jQuery('.sections').hide();
                jQuery('#about').show();
            });

            this.get('#contact', function() {
                self.navStatus('contact');
                jQuery('.sections').hide();
                jQuery('#contact').show();
            });
            
            this.get('#user', function() {
                self.navStatus('user');
                jQuery('.sections').hide();
                jQuery('#user').show();
            });
            this.get('#loginconfirm/:token',function() {
                self.performLogin(this.params['token']);
            });
            this.get('#logout',function(){
                self.performLogout();
            });
            this.get('', function() { self.go_to_home() });
        }).run();
        
        jQuery('body').ajaxSuccess(function(e, xhr, settings) {
            var data = jQuery.parseJSON(xhr.responseText);
            if (data.session !== self.getTokenFromStorage()) {
                self.setTokenInStorage(data.session);
            }
        }).ajaxError(function(event, jqXHR, ajaxSettings, thrownError){
            if (jqXHR.status === 403) {
                self.setTokenInStorage("");
                self.user(null);
                self.go_to_home();
            }
        });
        self.setAjax();
        var token = self.getTokenFromStorage();
        if (token) {
            self.loadUser();
        }
    }

    var app = new AppViewModel();
    ko.applyBindings(app, document.getElementById("navigation"));
    ko.applyBindings(app, document.getElementById("users"));
    ko.applyBindings(app, document.getElementById("home"));
});
