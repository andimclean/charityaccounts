$(document).ready(function () {
    function Account(data) {
        var self = this;
        data = data || {};
        self.id = ko.observable(data['id']);
        self.name = ko.observable(data['name'] || "");
        self.balance = ko.observable(data['balance'] || 0);
        
        self.removeUrl = ko.computed(function(){
            return "#in/removeAccount/"+self.id();
        });
        
        self.hasNameError = ko.computed(function(){
            return self.name().length == 0;
        });
        
        self.reset = function() {
	        self.id("");
	        self.name("");
	        self.balance(0);
        }
    }
    
    function Organisation(data) {
        var self = this;
        data = data || {};
        self.id = ko.observable(data['_id']);
        self.name = ko.observable(data['name']|| "");
        self.errorName = ko.observable("");
        self.accounts = ko.observableArray(data['accounts'] || []);
        self.hasNameError = ko.computed(function(){
            return self.name().length == 0 || self.errorName().length > 0;
        });
        
        self.reset = function() {
            self.name("");
            self.errorName("");
        };
        self.update = function(data) {
            self.id(data['_id']);
            self.name(data['name']|| "");
            self.errorName("");
            var accounts = data['accounts'] || [];
            
            var newAccounts = [];
            for(var loop = 0; loop < accounts.length; ++loop) {
                newAccounts.push(new Account(accounts[loop]));
            }
            self.accounts(newAccounts);
        }
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
        
        self.removalUrl = ko.computed(function(){
            return "#in/removeOrg/"+self.id();
        });
        
        self.orgUrl =  ko.computed(function(){
            return "#in/org/"+self.id();
        }); 
        
        self.addAccount = function(account) {
            var data = account.name();
            if (data) {
                jQuery.ajax({
                    url: '/api/addAccount',
                    data: {account: data,org: self.id()},
                    success: function(data) {
                        app.currentOrg().update(data.obj);
                        jQuery('#addAccount').modal('hide')
                    },
                    type: 'post'
                });
            }
        };
        
        self.removeAccount = function(accountId) {
            var item = self.accounts.arrayFirst(function(item){
                return item.id()==accountId;
            });
            if (item) {
                if (confirm("Remove Account " + item.name() + "?")) {
                    jQuery.ajax({
                        url: "/api/removeAccount",
                        data: {accountid: accountId, orgid: self.id()},
                        type: "post",
                        success: function(data) {
                            self.update(data['obj']);
                        }
                    });
                }
            }
        };
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
            } else {
                self.organisations([]);
                self.name(null);
                self.email("");
            }
        };
        
        self.isLoggedIn = ko.computed(function(){
            var name = self.name();
            return name !== null && name !== undefined;
        });
        
        self.removeOrg = function(id) {
            var item = self.organisations.arrayFirst(function(item){
                return id==item.id();
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
        self.user = ko.observable(new User());
        self.newOrg = ko.observable(new Organisation());
        self.currentOrg = ko.observable(new Organisation());
        self.newAccount = ko.observable(new Account());
        
        //behaviour
        function nextTick(next) {
            return function () {
                var argv = arguments;
                setTimeout( function() {
                    next.apply(self, argv);
                }, 0);
            }
        }
        
        self.go_to_home = nextTick(function() { location.hash = "home" });
        self.go_to_about = nextTick(function() { location.hash = "about" });
        self.go_to_contact = nextTick(function() { location.hash = "contact" });
        self.go_to_preferences = nextTick(function() { location.hash = "in/preferences"});
        self.go_to_org = nextTick(function(id) {
            if (id) {
                location.hash="in/org/"+id;
            } else {
                location.hash="in/org";
            }
        });
                
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
            return self.user() ? self.user().isLoggedIn() : false;
        });
        self.name = ko.computed(function(){
            var user = self.user();
            return user ? user.name() : "";
        });
        self.login = function() {
            jQuery("#sendloginemailbtn").button('loading');
            jQuery.ajax( {
                url: "/api/login",
                data: { email: self.email()},
                success: function(data) {
                    self.email("");
                    jQuery("#loginemailsent").modal();
                },
                error: function(data) {
                    alert("Failure : " + data);
                },
                type: "post"
            }).complete(function(){
              jQuery("#sendloginemailbtn").button('reset');
            });
            return false;
        }
        
        self.performLogin = function(token){
             jQuery.ajax( {
                url: "/api/loginConfirm",
                data: { token: token},
                success: function(data) {
                    self.user().updateUser(data.obj);
                    self.go_to_org();
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
        
        self.loadUser = function(next) {
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
            }).complete(next);
        };
        
        self.performLogout = function() {
            jQuery.ajax({
                url: '/api/logout',
                success: function(data){
                   self.user().updateUser(null);
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
            self.newOrg().reset();
        };
        
        self.loadOrg = function(orgID) {
            jQuery.ajax({
                url: '/api/getOrg/' + orgID,
                type: 'get',
                success: function(data) {
                    self.currentOrg().update(data.obj);
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
                self.user().updateUser(null);
                self.go_to_home();
            }
        });
        
        jQuery('.modal').on('shown', function () {
            jQuery(this).find('.autofocus').focus();
        });
        self.setUpRoutes = function() {    //setup
	        Sammy(function() {
	            this.before('', function() {
	                jQuery('.nav .dropdown.open').removeClass('open');
	                return true;
	            });
	          
                this.before(
                    {path: ['#in/.*']},
                    function (path) {
	                    if (!self.isLoggedIn())  {
	                        self.go_to_home();
	                        return false;
	                    } else {
	                        return true;
	                    }
	            });
	            
	            this.post('#login',function() {
	                self.login();
	                return false;
	            });
	            
	            this.get('#home', function() {
                    self.navStatus('home');
                    jQuery('.sections').hide();
                    jQuery('#home').show();
	            });
	            
	            this.get('#in/org', function() {
                    var orgs = self.user().organisations(); 
                    if (orgs.length == 0) {
                      self.go_to_preferences();
                    } else {
                      self.go_to_org(orgs[0].id());
                    }
	            });
	            
	            this.get('#in/org/:orgID', function() {
	                self.loadOrg(this.params['orgID']);
	                self.navStatus('org');
	                jQuery('.sections').hide();
	                jQuery('#org').show();
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
	            
	            this.get('#in/preferences', function() {
	                self.navStatus('preferences');
	                jQuery('.sections').hide();
	                jQuery('#preferences').show();
	            });
	            this.get('#loginconfirm/:token',function() {
	                self.performLogin(this.params['token']);
	            });
	            this.get('#in/logout',function(){
	                self.performLogout();
	            });
	            this.post('#in/addOrg',function(){
	                self.newOrg().addOrg(self.user());
	                self.newOrg().reset();
	            });
	            this.get('#in/removeOrg/:id',function(){
	                self.user().removeOrg(this.params['id']);
	                history.back();
	            });
	            this.post('#in/addAccount',function() {
	                self.currentOrg().addAccount(self.newAccount());
	                self.newAccount().reset();
	            });
                this.get('#in/removeAccount/:id',function(){
                    self.currentOrg().removeAccount(this.params['id']);
                    history.back();
                });
	            this.get('', function() { 
	                self.go_to_org();
                });
	        }).run();
        }
        var token = self.getTokenFromStorage();
        if (token) {
            self.setAjax();
            self.loadUser(self.setUpRoutes);
        } else {
          self.setUpRoutes();
        }
    }

    var app = new AppViewModel();
    ko.applyBindings(app, document.getElementById("navigation"));
    ko.applyBindings(app.user(), document.getElementById("preferences"));
    ko.applyBindings(app.user(), document.getElementById("home"));
    ko.applyBindings(app.newOrg(), document.getElementById("addOrg"));
    ko.applyBindings(app.currentOrg(), document.getElementById("org"));
    ko.applyBindings(app.newAccount(), document.getElementById("addAccount"));
});
