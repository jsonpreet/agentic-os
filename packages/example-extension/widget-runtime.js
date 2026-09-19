(function () {
  if (window.agentic) return;

  var extensionId = null;
  var permissions = [];
  var pending = new Map();

  function call(method, params) {
    if (!extensionId) {
      return Promise.reject(new Error('Agentic SDK is not initialized yet.'));
    }
    var requestId = 'req-' + Math.random().toString(36).slice(2);
    return new Promise(function (resolve, reject) {
      pending.set(requestId, { resolve: resolve, reject: reject });
      window.parent.postMessage(
        {
          type: 'agentic-sdk-request',
          extensionId: extensionId,
          requestId: requestId,
          method: method,
          params: params || {}
        },
        '*'
      );
    });
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'agentic-sdk-init') {
      extensionId = data.extensionId;
      permissions = Array.isArray(data.permissions) ? data.permissions : [];
      return;
    }

    if (data.type === 'agentic-sdk-response') {
      var handler = pending.get(data.requestId);
      if (!handler) return;
      pending.delete(data.requestId);
      if (data.error) {
        handler.reject(new Error(data.error));
      } else {
        handler.resolve(data.result);
      }
    }
  });

  window.agentic = {
    getContext: function () {
      return call('context.get');
    },
    storage: {
      get: function (key) {
        return call('storage.get', { key: key });
      },
      set: function (key, value) {
        return call('storage.set', { key: key, value: value });
      }
    },
    notifications: {
      show: function (title, body) {
        return call('notifications.show', { title: title, body: body });
      }
    },
    agents: {
      launchTask: function (prompt, options) {
        return call('agents.launchTask', {
          prompt: prompt,
          provider: options && options.provider,
          targetSessionId: options && options.targetSessionId
        });
      }
    }
  };

  window.parent.postMessage({ type: 'agentic-sdk-ready' }, '*');
})();
