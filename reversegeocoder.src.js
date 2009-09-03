if (! info){
    var info = {};
}

if (! info.aaronland){
    info.aaronland = {};
}

if (! info.aaronland.geo){
    info.aaronland.geo = {};
}

info.aaronland.geo.ReverseGeocoderResult = function(provider, pt, uuid, name){
    this.provider = provider;
    this.pt = pt;
    this.uuid = uuid;
    this.name = name;
}

info.aaronland.geo.ReverseGeocoderError = function(provider, query, errmsg){
    this.provider = provider;
    this.query = query;
    this.message = errmsg;
}

info.aaronland.geo.ReverseGeocoderCapabilities = function(args){

    this.has_google = 0;
    this.has_flickr = 0;

    this.can_reverse_geocode = 0;
    this.providers = [];

    // flickr

    if (typeof(info.aaronland.flickr) == 'object'){
        this.has_flickr = 1;
        this.can_geocode += 1;

        if ((args) && (! args['flickr_apikey'])){
            this.has_flickr = 0;
            this.can_geocode -= 1;
        }

        else {
            this.providers.push('flickr');
        }
    }

    // google

    if (typeof(google) == 'object'){
        this.has_google = 1;
        this.can_geocode += 1;

        this.providers.push('google');
    }

}

info.aaronland.geo.ReverseGeocoder = function(args){

    this.args = args;

    this.capabilities = new info.aaronland.geo.ReverseGeocoderCapabilities(args);
    this.providers = this.capabilities.providers;

    if ((args) && (args['providers'])){
        this.providers = args['providers'];
    }

    this.canhas_console = (typeof(console) == 'object') ? 1 : 0;

    this.timer_reversegeo = null;
    this.current_provider = null;
    this.current_query = null;

    this.on_success = null;
    this.on_fail = null;
};

info.aaronland.geo.ReverseGeocoder.prototype.reverse_geocode = function(pt, doThisOnSuccess, doThisIfNot, idx){

    if (this.timer_reversegeo) {
        this.log("terminating previously running reverse geocoder");

        clearTimeout(this.timer_reversegeo);
        this.timer_reversegeo = null;
    }

    if (this.providers.length == 0){
        this.error("No valid providers");
        return;
    }

    var _self = this;

    this.timer_reversegeo = setTimeout(function(){

            if (typeof(idx) == 'undefined'){
                idx = 0;
            }
            
            var provider = _self.providers[ idx ];

            _self.current_provider = provider;
            _self.current_query = pt;

            var local_doThisIfNot = doThisIfNot;

            if ((idx < _self.providers.length) && (idx != _self.providers.length)){
                
                var next_idx = idx + 1;
                var next_provider = _self.providers[ next_idx ];
            
                local_doThisIfNot = function(){
                    _self.reverse_geocode(pt, doThisOnSuccess, doThisIfNot, next_idx);
                    return;
                };
            }

            _self.on_success = doThisOnSuccess;
            _self.on_fail = local_doThisIfNot;

            if (provider == 'flickr'){
                _self._flickr();
                return;
            }

            else {
                _self.error('unknown provider');
                return;
            }

        }, 1500);

    return;
};

info.aaronland.geo.ReverseGeocoder.prototype._flickr = function(){

    var pt = this.current_query;

    if ((parseInt(pt['lat']) == 0) && (parseInt(pt['lon']) == 0)){
        this.error();
        return;
    }

    var _self = this;

    window['_reverseGeocodeComplete'] = function(rsp){

        if (rsp.stat == 'fail'){
            _self.error("reverse geocoding failed: " + rsp.message);
            return;
        }

        if (rsp.places.total == 0){
            _self.error("unable to reverse geocode your current position");
            return;
        }

        var name = rsp.places.place[0].name;
        var woeid = rsp.places.place[0].woeid;

        _self.success(woeid, name);
        return;
    };

    var method = 'flickr.places.findByLatLon';
    var accuracy = pt['zoom'];
    
    if (accuracy > 16){
        accuracy = 16;
    }

    var args = {
        'lat': pt['lat'],
        'lon': pt['lon'],
        'accuracy' : accuracy,
        'jsoncallback': '_reverseGeocodeComplete'
    };

    var flickr_args = {
        'key' : this.args['flickr_apikey'],
        'enable_logging' : this.args['enable_logging'],
    };

    var flickr = new info.aaronland.flickr.API(flickr_args)
    flickr.api_call(method, args);

    _self.log("reverse geocoding request dispatched");

    return;
}

info.aaronland.geo.ReverseGeocoder.prototype.success = function(uuid, name){

    this.log(this.current_provider + ' returned OK');
    var result = new info.aaronland.geo.ReverseGeocoderResult(this.current_provider, this.current_query, uuid, name);

    this.on_success(result);
    return;
}

info.aaronland.geo.ReverseGeocoder.prototype.error = function(msg){

    this.log(this.current_provider + ' failed: ' + msg);
    var error = new info.aaronland.geo.ReverseGeocoderError(this.current_provider, this.current_query, msg);

    this.on_fail(error);
    return;
}

info.aaronland.geo.ReverseGeocoder.prototype.log = function(msg){

    if (! this.args['enable_logging']){
        return;
    }

    if (! this.canhas_console){
        return;
    }

    console.log("[reversegeo] " + msg);
};

// -*-java-*-