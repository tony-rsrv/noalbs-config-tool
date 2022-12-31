(function() {
    const serverSchemas = JSON.parse('[{"type":"Belabox","statsUrl":"http://belabox-stats-url/yourkey","publisher":"yourkey"},{"type":"Nginx","statsUrl":"http://localhost/stats","application":"publish","key":"live"},{"type":"Nimble","statsUrl":"http://nimble:8082","id":"0.0.0.0:1234","application":"live","key":"srt"},{"type":"NodeMediaServer","statsUrl":"http://localhost:8000/api/streams","application":"publish","key":"live","auth":{"username":"admin","password":"admin"}},{"type":"Obs","source":"Media/VLC Source"},{"type":"SrtLiveServer","statsUrl":"http://localhost:8181/stats","publisher":"publish/live/feed1"}]');
    const serverTemplate = JSON.parse('{"name":"default","priority":0,"overrideScenes":null,"dependsOn":null,"enabled":true}');

    const validCommands = JSON.parse('[{"name":"Start","description":"On-demand command to start streaming in OBS.","example":"!start","role":"Admin"},{"name":"Stop","description":"On-demand command to stop streaming in OBS.","example":"!stop","role":"Admin"},{"name":"Rec","description":"On-demand command to toggle recording in OBS.","example":"!record","role":"Admin"},{"name":"Switch","description":"Switches to the provided scene (fuzzy match).","example":"!switch INTRO","role":"Admin"},{"name":"Source","description":"Toggles an OBS source items visibility on the current scene.","example":"!source media","role":"Admin"},{"name":"LiveScene","description":"Switch to the live scene.","example":"!live","role":"Admin"},{"name":"PrivacyScene","description":"Switch to the privacy scene","example":"!privacy","role":"Admin"},{"name":"StartingScene","description":"Switch to the starting scene","example":"!starting","role":"Admin"},{"name":"EndingScene","description":"Switch to the ending scene.","example":"!ending","role":"Admin"},{"name":"Trigger","description":"Changes the low bitrate threshold to the defined value.","example":"!trigger 800","role":"Mod"},{"name":"Otrigger","description":"Changes the offline bitrate threshold to the defined value.","example":"!otrigger 200","role":"Mod"},{"name":"Rtrigger","description":"Changes the RTT threshold to the defined value.","example":"!rtrigger 2000","role":"Mod"},{"name":"Ortrigger","description":"Changes the RTT based offline bitrate threshold to the defined value.","example":"!ortrigger 3000","role":"Mod"},{"name":"Sourceinfo","description":"Gives you details about the SOURCE in chat.","example":"!sourceinfo","role":"Mod"},{"name":"ServerInfo","description":"Gives you details about the SERVER in chat.","example":"!serverinfo","role":"Mod"},{"name":"Fix","description":"Tries to fix the stream.","example":"!fix","role":"Mod"},{"name":"Refresh","description":"Tries to fix the stream.","example":"!refresh","role":"Mod"},{"name":"Bitrate","description":"Gives you the current bitrate in chat.","example":"!bitrate","role":"Public"}]');
    var aliases = JSON.parse('[{"name":"Fix","permission":"Mod","alias":["f"]},{"name":"Switch","permission":"Mod","alias":["ss"]},{"name":"Bitrate","permission":null,"alias":["b"]},{"name":"PrivacyScene","permission":"Admin","alias":["brb"]}]');
    var defaultAliases = Array.from(aliases);
    const permissionRoles = {
        Admin: 'Admin',
        Mod: 'Mod',
        Public: null
    };

    const servers = [];
    const $serverList = document.querySelector('#server-list');
    const $selectServer = document.querySelector('#select-server');

    const $modalServer = document.querySelector('#serverModal');
    const $modalServerSubmit = $modalServer.querySelector('#add-server');
    const $modalServerType = $modalServer.querySelector('select');
    const $modalServerName = $modalServer.querySelector('#server-name');
    const $modalServerPriority = $modalServer.querySelector('#server-priority');
    const $modalServerEnabled = $modalServer.querySelector('#server-enabled');

    const $modalCommands = document.querySelector('#commandsModal');
    const $modalAddAlias = $modalCommands.querySelector('#add-alias');
    const $modalSubmitAlias = $modalCommands.querySelector('#submit-alias');

    const $modalServerConfig = document.querySelector('#serverConfigModal');
    
    const $command = document.querySelector('#command');

    function populateCommandList() {
        var commandFragment = document.createDocumentFragment();

        for (let index in validCommands) {
            let cmd = validCommands[index];

            let $option = document.createElement('option');
            $option.setAttribute('value', index);
            $option.setAttribute('data-name', cmd.name);
            $option.innerText = cmd.name;

            commandFragment.appendChild($option);
        }

        $command.appendChild(commandFragment);
    }

    function download(content, fileName, contentType) {
        const a = document.createElement("a");
        const file = new Blob([content], { type: contentType });
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        a.click();
    }

    var noalbsConfig = {};

    const saveEnv = () => {
        let invalidFound = false;
        let validityCheckElements = document.querySelectorAll('#bot input[required]');
        for (let elem of validityCheckElements) {
            if (!elem?.validity?.valid) {
                elem.classList.add('is-invalid');
                invalidFound = true;
            } else {
                elem.classList.remove('is-invalid');
            }
        }

        if (invalidFound) {
            createToastAlert('Please fix any invalid inputs', 'danger');
            return;
        }

        let botUsername = document.querySelector('#authenticationUsername').value;
        let botAuthToken = document.querySelector('#authenticationUsername').value;
        download(`TWITCH_BOT_USERNAME=${botUsername}\nTWITCH_BOT_OAUTH=${botAuthToken}`, '.env', 'text/plain');
    };

    const saveConfig = () => {
        let invalidFound = false;
        let validityCheckElements = document.querySelectorAll('#configForm input[required]');
        for (let elem of validityCheckElements) {
            if (!elem?.validity?.valid) {
                elem.classList.add('is-invalid');
                invalidFound = true;
            } else {
                elem.classList.remove('is-invalid');
            }
        }

        if (invalidFound) {
            document.querySelectorAll('.is-invalid')[0].scrollIntoView({
                behavior: 'auto',
                block: 'center',
                inline: 'center'
            });
            createToastAlert('Please fix any invalid inputs', 'danger');
            return;
        }

        let adminsArr = document.querySelector('#chatAdmins').value?.match(/[^,( ?)]{1,}/g);
        if (adminsArr == null || adminsArr == undefined) {
            adminsArr = [];
        } else if (adminsArr?.length > 0) {
            adminsArr = adminsArr[0] !== '' ? adminsArr : [];
        }

        let commands = {};
        aliases.forEach(({name,...rest}) => commands[name] = {...rest})

        noalbsConfig.user = {
            id: null,
            name: document.querySelector('#chatUsername').value,
            passwordHash: null
        };
        noalbsConfig.switcher = {
            bitrateSwitcherEnabled: document.querySelector('#switcherBitrateSwitcherEnabled').checked,
            onlySwitchWhenStreaming: document.querySelector('#switcherOnlySwitchWhenStreaming').checked,
            instantlySwitchOnRecover: document.querySelector('#switcherInstantlySwitchOnRecover').checked,
            autoSwitchNotification: document.querySelector('#switcherAutoSwitchNotification').checked,
            retryAttempts: +document.querySelector('#switcherRetryAttempts').value,
            triggers: {
                low: +document.querySelector('#switcherTriggersLow').value,
                rtt: +document.querySelector('#switcherTriggersRtt').value,
                offline: +document.querySelector('#switcherTriggersOffline').value || null,
            },
            switchingScenes: {
                normal: document.querySelector('#switchingScenesNormal').value,
                low: document.querySelector('#switchingScenesLow').value,
                offline: document.querySelector('#switchingScenesOffline').value
            },
            streamServers: servers
        };
        noalbsConfig.software = {
            type: document.querySelector('#softwareType').value,
            host: document.querySelector('#softwareHost').value,
            password: document.querySelector('#softwarePassword').value,
            port: +document.querySelector('#softwarePort').value
        };
        noalbsConfig.chat = {
            platform: 'Twitch',
            username: document.querySelector('#chatUsername').value,
            admins: adminsArr,
            prefix: document.querySelector('#chatPrefix').value,
            enablePublicCommands: document.querySelector('#chatEnablePublicCommands').checked,
            enableModCommands: document.querySelector('#chatEnableModCommands').checked,
            enableAutoStopStreamOnHostOrRaid: document.querySelector('#chatEnableAutoStopStreamOnHostOrRaid').checked,
            commands
        };
        noalbsConfig.optionalScenes = {
            starting: document.querySelector('#optionalScenesStarting').value || null,
            ending: document.querySelector('#optionalScenesEnding').value || null,
            privacy: document.querySelector('#optionalScenesPrivacy').value || null,
            refresh: document.querySelector('#optionalScenesRefresh').value || null
        };
        noalbsConfig.optionalOptions = {
            twitchTranscodingCheck: document.querySelector('#optionalOptionsTwitchTranscodingCheck').checked,
            twitchTranscodingRetries: +document.querySelector('#optionalOptionsTwitchTranscodingRetries').value,
            twitchTranscodingDelaySeconds: +document.querySelector('#optionalOptionsTwitchTranscodingDelaySeconds').value,
            offlineTimeout: +document.querySelector('#optionalOptionsOfflineTimeout').value || null,
            recordWhileStreaming: document.querySelector('#optionalOptionsRecordWhileStreaming').checked
        };
        noalbsConfig.language = document.querySelector('#language').selectedOptions[0].value;

        download(JSON.stringify(noalbsConfig, null, 2), 'config.json', 'text/plain');
    };

    const createServerEntry = serverInfo => {
        let $option = document.createElement('option');
        let serverCount = $serverList.options.length;

        $option.value = serverCount;
        $option.innerText = `${serverInfo.name} (${serverInfo.streamServer.type})`;

        servers.push(serverInfo);
        $serverList.appendChild($option);
    };

    const createToastAlert = (message, type='normal') => {
        let fragment = document.createDocumentFragment();
        let $alert = document.createElement('div');
        $alert.className = 'toast align-items-center text-bg-primary border-0 bottom-0 start-50 translate-middle-x position-fixed zindex-fixed';
        if (type !== 'normal') {
            $alert.classList.add(`bg-${type}`);
        }
        $alert.setAttribute('role', 'alert');
        $alert.setAttribute('aria-live', 'assertive');
        $alert.setAttribute('aria-atomic', true);
        $alert.setAttribute('data-bs-delay', 2500);
        $alert.style.zIndex = 1070;

        let $flex = document.createElement('div');
        $flex.className = 'd-flex';

        let $body = document.createElement('div');
        $body.className = 'toast-body';
        $body.innerText = message;

        let $close = document.createElement('button');
        $close.classList = 'btn-close btn-close-white me-2 m-auto';
        $close.setAttribute('type', 'button');
        $close.setAttribute('data-bs-dismiss', 'toast');
        $close.setAttribute('aria-label', 'Close');

        $flex.appendChild($body);
        $flex.appendChild($close);
        $alert.appendChild($flex);
        fragment.appendChild($alert);
        document.body.appendChild(fragment);

        let toast = new bootstrap.Toast($alert, {});
        toast.show();
    };

    const createInputsFromServer = server => {
        var fragments = [...Array(3)].map(_ => document.createDocumentFragment());

        for (let key in server.streamServer) {
            if (key == 'type') continue;

            let subfragment = document.createDocumentFragment();

            let $label = document.createElement('label');
            $label.setAttribute('for', key);
            $label.className = 'col-form-label';
            $label.innerText = `${key}:`;

            let $input = document.createElement('input');
            $input.setAttribute('type', 'text');
            $input.className = 'form-control';
            $input.setAttribute('id', key);

            if (key == 'auth' && server.streamServer.type == 'NodeMediaServer') {
                let { username, password } = server.streamServer[key];
                $input.value = `${username}:${password}`;
                $input.title = 'Please format as: username:password';
            } else {
                $input.value = server.streamServer[key];
            }

            subfragment.appendChild($label);
            subfragment.appendChild($input);

            fragments[0].appendChild(subfragment);
        }

        let $page1Subfragment = document.createDocumentFragment();
        let $page2Subfragment = document.createDocumentFragment();

        let $formCheck = document.createElement('div');
        $formCheck.className = 'form-check';

        let hasOverrides = server.overrideScenes !== null;

        let $formCheckLabel = document.createElement('label');
        $formCheckLabel.className = 'form-label';
        $formCheckLabel.innerText = 'Enable override scenes';
        $formCheckLabel.setAttribute('for', 'enable-overide');

        let $formCheckInput = document.createElement('input');
        $formCheckInput.className = 'form-check-input';
        $formCheckInput.setAttribute('type', 'checkbox');
        $formCheckInput.setAttribute('id', 'enable-override');
        $formCheckInput.setAttribute('placeholder', 'Input');
        $formCheckInput.checked = hasOverrides;

        $formCheck.appendChild($formCheckLabel);
        $formCheck.appendChild($formCheckInput);

        let $overrideNormalLabel = document.createElement('label');
        $overrideNormalLabel.className = 'col-form-label';
        $overrideNormalLabel.innerText = 'Normal scene override:';
        $overrideNormalLabel.setAttribute('for', 'override-normal');

        let $overrideNormalInput = document.createElement('input');
        $overrideNormalInput.className = 'form-control';
        $overrideNormalInput.setAttribute('type', 'text');
        $overrideNormalInput.setAttribute('id', 'override-normal');
        $overrideNormalInput.value = (hasOverrides) ? server.overrideScenes?.normal : '';

        let $overrideLowLabel = document.createElement('label');
        $overrideLowLabel.className = 'col-form-label';
        $overrideLowLabel.innerText = 'Low scene override:';
        $overrideLowLabel.setAttribute('for', 'override-low');

        let $overrideLowInput = document.createElement('input');
        $overrideLowInput.className = 'form-control';
        $overrideLowInput.setAttribute('type', 'text');
        $overrideLowInput.setAttribute('id', 'override-low');
        $overrideLowInput.value = (hasOverrides) ? server.overrideScenes?.low : '';

        let $overrideOfflineLabel = document.createElement('label');
        $overrideOfflineLabel.className = 'col-form-label';
        $overrideOfflineLabel.innerText = 'Offline scene override:';
        $overrideOfflineLabel.setAttribute('for', 'override-offline');

        let $overrideOfflineInput = document.createElement('input');
        $overrideOfflineInput.className = 'form-control';
        $overrideOfflineInput.setAttribute('type', 'text');
        $overrideOfflineInput.setAttribute('id', 'override-offline');
        $overrideOfflineInput.value = (hasOverrides) ? server.overrideScenes?.offline : '';

        $page1Subfragment.appendChild($formCheck);
        $page1Subfragment.appendChild($overrideNormalLabel);
        $page1Subfragment.appendChild($overrideNormalInput);
        $page1Subfragment.appendChild($overrideLowLabel);
        $page1Subfragment.appendChild($overrideLowInput);
        $page1Subfragment.appendChild($overrideOfflineLabel);
        $page1Subfragment.appendChild($overrideOfflineInput);

        fragments[1].appendChild($page1Subfragment);

        let hasDependency = server.dependsOn !== null;

        let $dependsOnLabel = document.createElement('label');
        $dependsOnLabel.className = 'col-form-label';
        $dependsOnLabel.setAttribute('for', 'server-dependency');

        let $serverDependencyInput = document.createElement('select');
        $serverDependencyInput.className = 'form-select';
        $serverDependencyInput.setAttribute('id', 'server-dependency');

        let $dependsOnSmall = document.createElement('small');
        $dependsOnSmall.className = 'form-text text-muted';
        $dependsOnLabel.innerText = 'Select a secondary ingest if required in this servers configuration.';

        let $backupNormalLabel = document.createElement('label');
        $backupNormalLabel.className = 'col-form-label';
        $backupNormalLabel.innerText = 'Normal scene backup:';
        $backupNormalLabel.setAttribute('for', 'backup-normal');

        let $backupNormalInput = document.createElement('input');
        $backupNormalInput.className = 'form-control';
        $backupNormalInput.setAttribute('type', 'text');
        $backupNormalInput.setAttribute('id', 'backup-normal');
        $backupNormalInput.setAttribute('disabled', hasDependency);
        $backupNormalInput.value = (hasDependency) ? server.dependsOn?.normal : '';

        let $backupLowLabel = document.createElement('label');
        $backupLowLabel.className = 'col-form-label';
        $backupLowLabel.innerText = 'Low scene backup:';
        $backupLowLabel.setAttribute('for', 'backup-low');

        let $backupLowInput = document.createElement('input');
        $backupLowInput.className = 'form-control';
        $backupLowInput.setAttribute('type', 'text');
        $backupLowInput.setAttribute('id', 'backup-low');
        $backupLowInput.setAttribute('disabled', hasDependency);
        $backupLowInput.value = (hasDependency) ? server.dependsOn?.low : '';

        let $backupOfflineLabel = document.createElement('label');
        $backupOfflineLabel.className = 'col-form-label';
        $backupOfflineLabel.innerText = 'Offline scene backup:';
        $backupOfflineLabel.setAttribute('for', 'backup-offline');

        let $backupOfflineInput = document.createElement('input');
        $backupOfflineInput.className = 'form-control';
        $backupOfflineInput.setAttribute('type', 'text');
        $backupOfflineInput.setAttribute('id', 'backup-offline');
        $backupOfflineInput.setAttribute('disabled', hasDependency);
        $backupOfflineInput.value = (hasDependency) ? server.dependsOn?.offline : '';

        $page2Subfragment.appendChild($dependsOnLabel);
        $page2Subfragment.appendChild($serverDependencyInput);
        $page2Subfragment.appendChild($dependsOnSmall);

        $page2Subfragment.appendChild($backupNormalLabel);
        $page2Subfragment.appendChild($backupNormalInput);
        $page2Subfragment.appendChild($backupLowLabel);
        $page2Subfragment.appendChild($backupLowInput);
        $page2Subfragment.appendChild($backupOfflineLabel);
        $page2Subfragment.appendChild($backupOfflineInput);

        fragments[2].appendChild($page2Subfragment);

        return fragments;
    };

    $modalServerSubmit.addEventListener('click', _ => {
        let serverIndex = parseInt($modalServerType?.selectedIndex) || 0;
        let streamServer = serverSchemas[serverIndex];

        let serverName = $modalServerName.value || streamServer.type;
        let serverPriority = parseInt($modalServerPriority?.value) || 0;
        let serverEnabled = $modalServerEnabled?.checked == true;

        let foundIndex = servers.findIndex(val => val.name == serverName);
        if (foundIndex !== -1) {
            createToastAlert(`A server named ${serverName} already exists!`, 'danger');
            return;
        }

        let serverInfo = Object.assign({}, serverTemplate, {
            name: serverName,
            priority: serverPriority,
            streamServer,
            enabled: serverEnabled
        });

        createServerEntry(serverInfo);
        createToastAlert(`Added ${streamServer.type} server as ${serverName}`);

        $modalServer.querySelector('.btn-close').click();
    });

    $selectServer.addEventListener('click', _ => {
        let { selectedIndex } = $serverList;
        if (selectedIndex == -1) return;
    });

    var configPage = 0;

    $modalServerConfig.addEventListener('hidden.bs.modal', function(ev) {
        configPage = 0;

        let $page0 = this.querySelector('div[data-page="0"]');
        let $page1 = this.querySelector('div[data-page="1"]');
        let $page2 = this.querySelector('div[data-page="2"]');

        $page0.hidden = false;
        $page0.innerHTML = '';

        $page1.hidden = true;
        $page1.innerHTML = '';

        $page2.hidden = true;
        $page2.innerHTML = '';
    });

    $modalServerConfig.addEventListener('shown.bs.modal', function(ev) {
        let { selectedIndex } = $serverList;
        var server = servers[selectedIndex];

        if (server.dependsOn == null) return;

        let $serverDependency = document.querySelector('#server-dependency');
        let selectedDependency = [...$serverDependency.options].findIndex(val => {
            return val.innerText.split(' (')[0] == server.dependsOn?.name;
        });

        $serverDependency.selectedIndex = selectedDependency;
    });

    $modalServerConfig.addEventListener('show.bs.modal', function(ev) {
        var { selectedIndex } = $serverList;
        if ($serverList.options.length == 0 || selectedIndex == -1) {
            ev.preventDefault();
            ev.stopPropagation();
            createToastAlert('Error: Could not find any server configurations', 'danger');
            return;
        }

        var server = servers[selectedIndex];

        this.querySelector('#server-type').innerText = server.streamServer.type;
        this.querySelector('#server-name').innerText = server.name;
        this.querySelector('#server-priority').value = parseInt(server.priority) || 0;
        this.querySelector('#server-enabled').checked = server.enabled;

        let [ ingestInfo, overrideInfo, dependsInfo ] = createInputsFromServer(server);

        var $page0 = this.querySelector('div[data-page="0"]');
        $page0.appendChild(ingestInfo);

        var $page1 = this.querySelector('div[data-page="1"]');
        $page1.appendChild(overrideInfo);

        var $page2 = this.querySelector('div[data-page="2"]');
        $page2.appendChild(dependsInfo);

        let $serverDependency = document.querySelector('#server-dependency');
        $serverDependency.innerHTML = $serverList.innerHTML;
        $serverDependency.options.remove(selectedIndex);

        var $backupNormal = $page2.querySelector('#backup-normal');
        var $backupLow = $page2.querySelector('#backup-low');
        var $backupOffline = $page2.querySelector('#backup-offline');

        if (server.dependsOn !== null) {
            $backupNormal.value = server.dependsOn.backupScenes.normal;
            $backupLow.value = server.dependsOn.backupScenes.low;
            $backupOffline.value = server.dependsOn.backupScenes.offline;
        }

        $serverDependency.onchange = function() {
            let { options: { selectedIndex } } = this;

            if (selectedIndex == 0) {
                $backupNormal.value = '';
                $backupNormal.disabled = true;

                $backupLow.value = '';
                $backupLow.disabled = true;

                $backupOffline.value = '';
                $backupOffline.disabled = true;

                return;
            }

            let selectedServer = servers[selectedIndex];

            $backupNormal.value = selectedServer.dependsOn?.normal || '';
            $backupNormal.disabled = false;

            $backupLow.value = selectedServer.dependsOn?.low || '';
            $backupLow.disabled = false;

            $backupOffline.value = selectedServer.dependsOn?.offline || '';
            $backupOffline.disabled = false;
        };
        
        let $nullOption = document.createElement('option');
        $nullOption.setAttribute('value', -1);
        $nullOption.setAttribute('selected', true);
        $nullOption.innerText = 'No selection';

        $serverDependency.prepend($nullOption);

        let $prevPage = this.querySelector('#previous-page');
        let $nextPage = this.querySelector('#next-page');
        let $saveServer = this.querySelector('#save-server');

        $prevPage.onclick = function() {
            let { parentElement: parent } = this;
            parent.querySelector(`div[data-page="${configPage}"]`).hidden = true;
            configPage = Math.min(Math.max(parseInt(configPage-1) || 0, 0), 2);
            parent.querySelector(`div[data-page="${configPage}"]`).hidden = false;
        };
        $nextPage.onclick = function() {
            let { parentElement: parent } = this;
            parent.querySelector(`div[data-page="${configPage}"]`).hidden = true;
            configPage = Math.min(Math.max(parseInt(configPage+1) || 0, 0), 2);
            parent.querySelector(`div[data-page="${configPage}"]`).hidden = false;
        };

        $saveServer.onclick = function() {
            let server = { streamServer: {} };

            let editingServerName = this.parentElement.querySelector('#server-name').innerText;
            let editingServerType = this.parentElement.querySelector('#server-type').innerText;

            server.name = editingServerName;
            server.priority = parseInt(this.parentElement.querySelector('#server-priority')?.value) || 0;
            server.enabled = this.parentElement.querySelector('#server-enabled').checked;
            server.streamServer.type = editingServerType;

            let ingestInputs = $page0.querySelectorAll('input');
            for (let inputElem of ingestInputs) {
                let { id, value } = inputElem;
                server.streamServer[id] = value;

                if (id == 'auth' && editingServerType == 'NodeMediaServer') {
                    let splitValue = value.split(':');
                    if (splitValue.length !== 2) {
                        createToastAlert('Error: Invalid username and password pair', 'danger');
                        return;
                    }
                    let [ username, password ] = splitValue;
                    server.streamServer[id] = { username, password };
                }
            }

            let overrideEnabled = $page1.querySelector('#enable-override').checked;
            if (overrideEnabled) {
                let normalSceneOverride = $page1.querySelector('#override-normal').value;
                let lowSceneOverride = $page1.querySelector('#override-low').value;
                let offlineSceneOverride = $page1.querySelector('#override-offline').value;

                server.overrideScenes = {
                    normal: normalSceneOverride,
                    low: lowSceneOverride,
                    offline: offlineSceneOverride
                };
            } else {
                server.overrideScenes = null;
            }

            let { options } = $serverDependency;
            let { selectedIndex } = options;
            if (selectedIndex !== -1) {
                let selectedOption = options[selectedIndex];
                if (selectedOption.innerText !== 'No selection') {
                    let [ serverName, serverType ] = selectedOption.innerText.split(' (');
                    serverType = serverType?.slice(0,-1);

                    let normalSceneBackup = $page2.querySelector('#backup-normal').value;
                    let lowSceneBackup = $page2.querySelector('#backup-low').value;
                    let offlineSceneBackup = $page2.querySelector('#backup-offline').value;

                    if (normalSceneBackup !== '' || lowSceneBackup !== '' || offlineSceneBackup !== '') {
                        server.dependsOn = {
                            name: serverName,
                            backupScenes: {
                                normal: normalSceneBackup,
                                low: lowSceneBackup,
                                offline: offlineSceneBackup
                            }
                        };
                    }
                }
            }

            let serverIndex = servers.findIndex(val => val.name == editingServerName && val.streamServer.type == editingServerType);
            if (serverIndex !== -1) {
                servers[serverIndex] = server;
            }

            $modalServerConfig.querySelector('.btn-close').click();
        };
    });

    $modalCommands.addEventListener('show.bs.modal', function(ev) {
        let $commandSelector = this.querySelector('#command');
        let $commandTitle = this.querySelector('#command-name');
        let $commandDescription = this.querySelector('#command-description');
        let $commandExample = this.querySelector('#command-example');
        let $commandAlias = this.querySelector('#command-alias');
        let $commandRole = this.querySelector('#alias-role');

        $modalAddAlias.onclick = () => {
            let { options } = $commandSelector;
            let { selectedIndex } = options;
            let selectedCommand = options[selectedIndex].getAttribute('data-name');
            let aliasName = options[selectedIndex].getAttribute('data-alias') || '';

            let { name, description, example, role } = validCommands.find(cmd => cmd.name == selectedCommand);
            $commandTitle.innerText = name;
            $commandDescription.innerText = description;
            $commandExample.innerText = example;

            let roleIndex = Object.values($commandRole.options).findIndex(a => a.getAttribute('data-name') == role);
            $commandRole.selectedIndex = roleIndex;

            let existingAliasIndex = Object.values(aliases).findIndex(a => a.name == name);
            if (existingAliasIndex !== -1) {
                $commandAlias.value = aliases[existingAliasIndex].alias;
            } else {
                $commandAlias.value = '';
            }
        };

        $modalSubmitAlias.onclick = () => {
            let name = $commandTitle.innerText;
            if (name == null) return;

            let aliasVal = $commandAlias.value;
            let roleValName = $commandRole.selectedOptions[0].getAttribute('data-name');
            let roleIndicator = permissionRoles?.[roleValName] || null;

            let newAlias = {
                name,
                permission: roleIndicator,
                alias: [ aliasVal ]
            };

            let existingAliasIndex = Object.values(aliases).findIndex(a => a.name == name);
            if (existingAliasIndex == -1) {
                aliases.push(newAlias);
            } else {
                aliases[existingAliasIndex] = newAlias;
            }
        };
    });

    document.querySelector('#restore-aliases').onclick = () => {
        if (confirm('Are you sure you want to restore default aliases?')) {
            aliases = defaultAliases;
            createToastAlert('Restoring default aliases.');
        }
    };

    document.querySelector('#theme-toggle').onclick = () => darkmode.toggleDarkMode();
    document.querySelector('#download-config').onclick = saveConfig;
    document.querySelector('#save-env').onclick = saveEnv;

    const validAnchors = ['switcher','switching','servers','software','chat','optional','bot'];
    const hashTokens = location.hash.split(/[^a-zA-Z\d\s:]/);
    for (let hash=0; hash<hashTokens.length; hash++) {
        for (let anchor=0; anchor<validAnchors.length; anchor++) {
            if (hashTokens[hash] != validAnchors[anchor]) continue;
            document.querySelector(`#${hashTokens[hash]}`).scrollIntoView();
        }
    }

    let $menuLinks = document.querySelectorAll('#sidebar ul li a');
    for (let link=0; link<$menuLinks.length; link++) {
        $menuLinks[link].addEventListener('click', ({ target }) => {
            document.querySelector('li a.active').classList.remove('active');
            target.classList.add('active');
        });
    }

    populateCommandList();
})();