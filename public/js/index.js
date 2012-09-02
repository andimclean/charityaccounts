$(document).ready(function () {

    function Organisation(data) {
        var self = this;
        data = data || {};
        self.id = data['_id'];
        self.name = ko.observable(data['name']|| "");
        self.errorName = ko.observable("");
        
        self.hasNameError = ko.computed(function(){
            return self.name().length == 0 || self.errorName().length > 0;
        });
        
        self.reset = function() {
            self.name("");
            self.errorName("");
        };
                
        self.addOrg = function(user) {
            var data = self.name();
          
            if (data) {
                jQuery.ajax({
                    url: "/api/addOrg",
                    data: {orgs : data},
                    success: function(data) {
                        user.updateUser(data.obj);
                        jQuery('#addOrg').modal('hide')
                    },
                    error: function(jqXHR, textStatus, errorThrown){
                         
                    },
                    type: 'post'
                });
            }
        };
        
        self.url = ko.computed(function(){
            return "#removeOrg/"+self.id;
        });
        
        self.orgUrl =  ko.computed(function(){
            return "#home/"+self.id;
        }); 
    }
    
    function User(data) {
        var self = this;
        data = data || {};
        // Datas
        self.name = ko.observable(data['name']);
        self.email = ko.observable(data['email']);
        self.organisations = ko.observableArray();
        
        //behaviours
        self.updateUser = function(user){
            if (user) {
                var orgs = user.organisations;
                var ret = [];
                for(var loop = 0; loop < orgs.length; ++loop) {
                    ret.push(new Organisation(orgs[loop]));
                }
                
                self.organisations(ret);
                self.name(user.name);
                self.email(user.email);
            }
        };
        
        self.isLoggedIn = ko.computed(function(){
            var name = self.name();
            return name !== null && name !== undefined;
        });
        
        self.removeOrg = function(id) {
            var item = self.organisations.arrayFirst(function(item){
                return id==item.id;
            });
            if (item) {
                if (confirm("Remove Organisation " + item.name() + "?")) {
                    jQuery.ajax({
                        url: "/api/removeOrg",
                        data: {orgid: id},
                        type: "post",
                        success: function(data) {
                            self.updateUser(data['obj']);
                        }
                    });
                }
            }
        };
    }
    function AppViewModel(data) {
        var self = this;
        data = data || {}
        self.email = ko.observable("");
        self.navStatus = ko.observable("home");
        self.user = ko.observable(data['user'] || new User());
        self.org = ko.observable(data['org']);
        
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
            return self.user().isLoggedIn();
        });
        self.name = ko.computed(function(){
            var user = self.user();
            return user ? user.name() : "";
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
                    self.user().updateUser(data.obj);
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
                  self.user().updateUser(data.obj);
                },
                error: function(jqXHR, textStatus, errorThrown){
                    if (jqXHR.status === 403) {
                        self.user().updateUser(null);
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
                        self.user().updateUser(null);
                        self.go_to_home();
                    } else {
                        alert(errorThrown);
                    }
                },
                type: 'post'
            });
        };

        self.resetOrg = function() {
            self.org().reset();
        };
        
        self.loadOrg = function(orgID) {
            jQuery.ajax({
                url: '/api/getOrg/' + orgID,
                type: 'get',
                success: function(data) {
                    self.org(new Organisation(data.obj));
                }
            });
        }
        
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
        var token = self.getTokenFromStorage();
        if (token) {
            self.setAjax();
            self.loadUser();
        }
        
        //setup
        Sammy(function() {
            this.post('#login',function() {
                self.login();
                return false;
            });
            
            this.get('#home', function() {
                self.org(null);
                self.navStatus('home');
                jQuery('.sections').hide();
                jQuery('#home').show();
            });
            
            this.get('#home/:orgID', function() {
                self.org(self.loadOrg(this.params['orgID']));
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
            this.post('#addOrg',function(){
                self.org().addOrg(self.user());
            });
            this.get('#removeOrg/:id',function(){
                self.user().removeOrg(this.params['id']);
                self.go_to_home();
            });
            this.get('', function() { self.go_to_home() });
        }).run();
        

    }

    var user = new User();
    var org = new Organisation();

    var app = new AppViewModel({
        user: user,
        org: org
    });
    ko.applyBindings(app, document.getElementById("navigation"));
    ko.applyBindings(user, document.getElementById("user"));
    ko.applyBindings(user, document.getElementById("home"));
    ko.applyBindings(org, document.getElementById("addOrg"));
});
