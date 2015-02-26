/**
 * Created by Leo on 04/02/2015.
 */
'use strict';

angular.module('amonalieApp')
  .factory('Amonalies', ['$http','$rootScope','$location','Logger','Auth','Modal', function($http,$rootScope,$location,Logger,Auth,Modal) {
    var _amonalies = [];
    //var colors = ['#87e0fd',"fuchsia","gray","green","lime","maroon","navy","olive","orange","purple","red","silver","teal","yellow",
    //              "darkblue","darkmagenta","black","darkgreen","dodgerblue","indigo","darkorange","olivedrab ","orchid"];

    var colors = [
        '#87e0fd', //celestino
        '#cdeb8e', //verdino
        '#606c88', //grigio-celeste
        '#ff7400', //arancioncino
        '#ff1a00', //rossotto
        '#4f85bb', //celeste
        '#febf01', //giallo
        '#a4b357', //oliva
      ];

    var states = ['dafare','fando','fatto'];
    var _apps = [];
    var checkKnown = function(amonalies) {
      if (amonalies && amonalies.length) {
        if (_amonalies.length) {
          amonalies.forEach(function (a) {
            a.new = !$.grep(_amonalies, function (exa) { return exa.code == a.code; }).length;
          });
        }
        else if (!_amonalies.length)
          _amonalies = amonalies;
      }
    };

    var getAppColor = function(app){
      var lng = colors.length;
      var pos = _apps.indexOf(app);
      var index = pos % lng;
      if (index<0) return 'white';
      return colors[index];
    };

    /**
     * Restituisce l'elenco delle amonalie
     * @param cb
     */
    var getAmonalies = function(cb) {
      cb = cb || angular.noop;
      var apps = [];
      $http.get('/api/amonalie')
        .success(function(amonalies){
          //inserisce le info sui targets
          getTargets(function(targets) {
            amonalies.forEach(function (a) {
              if (apps.indexOf(a.app)<0)
                apps.push(a.app);
              if (a.tasks.length && targets.length)
                a.tasks.forEach(function (t) {
                  if (t.target) {
                    var result = $.grep(targets, function (target) {
                      return (target._id == t.target);
                    });
                    if (result.length)
                      t.target_info = result[0];
                  }
                });
            });
            _apps = apps;
            checkKnown(amonalies);
            cb(amonalies, targets);
          });
        })
        .error(function(err){
          Logger.error('Errori nel caricamento delle amonalie', JSON.stringify(err));
        });
    };

    var modalEditAmonalia = Modal.confirm.editamonalia(function(info){
      if (info.history && !info.a.archived && !confirm('Attenzione, l\'anomalia sarà archiviata negli storici, continuare?')) {
        info.def.reject();
        return;
      }
      if (info.obj.state)
        info.a.state = info.obj.state;
      if (info.def && info.def.resolve)
        info.def.resolve();
      if (info.history) {
        info.a.archived = info.a.archived ? false : true;
      }

      update('amonalie',info.a,'Amonalia','code');
    });

    var editAmonalia = function(amonalia, opt){
      if (opt) {
        switch(opt.state) {
          //fatte
          case states[2]:
            //TODO: verifica la chiusura di tutti i task dell'anomalia
            break;
          //fando
          case states[1]:
            //TODO: se non esiste un task aperto ne crea uno nuovo
            break;
          //da fare
          case states[0]:
            break;
        }
      }

      if (!amonalia.state && !opt)
        opt = { state:'dafare' };

      var info = {
        title: '<strong>'+amonalia.code+'</strong> - '+amonalia.app,
        a: amonalia,
        t: opt ? opt.task : undefined,
        obj: {
          state: opt ? opt.state : amonalia.state,
          note: amonalia.note
        },
        readonly: opt ? opt.readonly : false,
        def: opt ? opt.def : undefined
      };
      modalEditAmonalia(info);
    };

    var modalEditTarget = Modal.confirm.edittarget(function(info){
      if (info.history && !info.target.archived && !confirm('Attenzione, l\'obiettivo sarà archiviato negli storici, continuare?')) {
        info.def.reject();
        return;
      }

      info.target.name = info.obj.title;
      info.target.info = info.obj.desc;
      info.target.active = info.obj.active;
      info.target.date = getDateNum(info.obj.date);
      if (info.history) {
        info.target.archived = info.target.archived ? false : true;
      }

      update('targets',info.target,'Obiettivo');
    });

    function update(dest, obj, typedesc, namep) {
      namep = namep || 'name';
      if (obj._id){
        $http.put('/api/'+dest+'/'+obj._id, obj)
          .success(function(){
            Logger.ok(typedesc+' "'+ obj[namep]+'" aggiornato correttamente!');
          })
          .error(function(err){
            Logger.error('Errori nell\'aggiornamento di ('+typedesc+'): "'+ obj[namep]+'"', JSON.stringify(err));
          });
      }
      else {
        $http.post('/api/'+dest, obj)
          .success(function(){
            Logger.ok(typedesc+' "'+ obj[namep]+'" creato correttamente!');
          })
          .error(function(err){
            Logger.error('Errori nella creazione dell\'elemento di tipo '+typedesc, JSON.stringify(err));
          });
      }
    }

    var createNewTarget = function() {
      Auth.isLoggedInAsync(function(islogged) {
        if (islogged) {
          var target = {
            name: 'Nuovo obiettivo',
            info: '',
            author: Auth.getCurrentUser()._id,
            active: true,
            date: (new Date()).getTime()
          };
          editTarget(target);
        }
      });
    };

    var editTarget = function(target){
      var info = {
        title: target._id ? 'modifica Obiettivo' :  'Nuovo Obiettivo',
        target: target,
        obj: {
          title:target.name,
          desc: target.info,
          active: target.active,
          date: target.date
        }
      };

      modalEditTarget(info);
    };

    /**
     * Elimina l'amonalia
     * @param a
     * @param cb
     */
    var deleteAmonalia = function(a, cb) {
      cb = cb || angular.noop;
      var args = {
        action: 'remove',
        a: a
      };
      return manageAmonalia(args, cb)
    };

    var updateAmonalia = function(a, cb) {
      cb = cb || angular.noop;
      $http.put('/api/amonalie/'+ a._id, a)
        .success(function(a){
          cb(a);
        })
        .error(function(err){
          Logger.error('Errori nell\'aggiornamento dell\'anomalia '+ a.code, JSON.stringify(err));
        });
    };

    /**
     * Gestisce l'amonalia
     * @param args
     * @param cb
     */
    var manageAmonalia = function(args, cb) {
      cb = cb || angular.noop;
      $http.post('/api/amonalie/manage', args)
        .success(function(a){
          cb(a);
        })
        .error(function(err){
          Logger.error('Errori nella gestione dell\'anomalia '+ a.code, JSON.stringify(err));
        });
    };

    var getTargets = function(cb) {
      cb = cb || angular.noop;
      $http.get('/api/targets')
        .success(function(targets){
          cb(targets);
        })
        .error(function(err){
          Logger.error('Errori nel caricamento dei targets', JSON.stringify(err));
        });
    };

    var deleteTarget = function(target, cb) {
      cb = cb || angular.noop;
      $http.delete('/api/targets/' + target._id)
        .success(function(){
          Logger.ok(target.name+' eliminato correttamente.');
          cb();
        })
        .error(function(err){
          Logger.error('Errori durante l\'eliminazione del target', JSON.stringify(err));
        });
    };

    var _milking = false;
    var milk = function(options) {
      var user = Auth.getCurrentUser();
      if (!user.assistant.length || !user.assistant[0].username || !user.assistant[0].password) {
        $location.path('/settings').search('message=assistant');
        return;
      };
      if (_milking) {
        Logger.warning('Mungitura in corso!','attendere...')
        return;
      }
      _milking = true;
      $rootScope.$broadcast('MILKING');
      options = options || {};

      $http.post('/api/amonalie/assistant/'+user._id, options)
        .success(function(result){
          var report = 'Aggiunte:'+result.added.length+'; Aggiornate:'+result.updated.length+'; Scartate:'+result.discards.length+';';
          Logger.ok('Milk Terminato!', report);
        })
        .error(function(err){
          Logger.error('Errori nel caricamento delle amonalie', JSON.stringify(err));
        })
        .then(function() {
          _milking = false;
          $rootScope.$broadcast('MILKING');
        });
    };

    var dragging = {};

    var getDateStr = function(dt){
      if (typeof dt=='string')
        return dt;
      if (typeof dt =='number')
        dt = new Date(dt);
      if (!dt)
        dt = new Date();
      if (dt.getDate)
        return dt.getDate()+'/'+(dt.getMonth()+1)+'/'+dt.getFullYear();
    };

    var getDateByString = function(dt) {
      var d = new Date();
      var v = dt.split('/');
      if (v && v.length>2){
        d = new Date(v[2],v[1],v[0]);
      }
      return d;
    };

    var getDateNum = function(dt) {
      if (typeof dt=='string')
        dt = getDateByString(dt);
      if (!dt.getTime)
        dt = new Date();
      return dt.getTime();
    };

    return {
      editAmonalia:editAmonalia,
      apps:function(){return _apps;},
      getAppColor:getAppColor,
      createNewTarget:createNewTarget,
      editTarget:editTarget,
      getDateStr:getDateStr,
      deleteAmonalia:deleteAmonalia,
      updateAmonalia:updateAmonalia,
      useTargets:getTargets,
      deleteTarget:deleteTarget,
      get: getAmonalies,
      milk:milk,
      milking:function(){return _milking;},
      checkKnown:checkKnown,
      dragging:dragging
    }
  }]);
