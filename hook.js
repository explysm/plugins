Java.perform(function() {
    var OkHttpClient = Java.use("okhttp3.OkHttpClient");
    var Response = Java.use("okhttp3.Response");
    
    OkHttpClient.newCall.overload("okhttp3.Request").implementation = function(request) {
        console.log(">>> Request:", request.url());
        var response = this.newCall(request);
        console.log("<<< Response:", response.code());
        return response;
    };
});
