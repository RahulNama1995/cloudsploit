var async = require('async');
var helpers = require('../../../helpers/google');

module.exports = {
    title: 'Secure Boot Enabled',
    category: 'Kubernetes',
    description: 'Ensures all Kubernetes cluster nodes have secure boot feature enabled.',
    more_info: 'Secure Boot feature protects your cluster nodes from malware and makes sure the system runs only authentic software.',
    link: 'https://cloud.google.com/kubernetes-engine/docs/how-to/shielded-gke-nodes#secure_boot',
    recommended_action: 'Ensure that Secure Boot feature is enabled for all node pools in your GKE clusters.',
    apis: ['clusters:list', 'projects:get'],

    run: function(cache, settings, callback) {
        var results = [];
        var source = {};
        var regions = helpers.regions();

        let projects = helpers.addSource(cache, source,
            ['projects','get', 'global']);

        if (!projects || projects.err || !projects.data || !projects.data.length) {
            helpers.addResult(results, 3,
                'Unable to query for projects: ' + helpers.addError(projects), 'global', null, null, (projects) ? projects.err : null);
            return callback(null, results, source);
        }

        var project = projects.data[0].name;

        async.each(regions.clusters, function(region, rcb){
            let clusters = helpers.addSource(cache, source,
                ['clusters', 'list', region]);

            if (!clusters) return rcb();

            if (clusters.err || !clusters.data) {
                helpers.addResult(results, 3, 'Unable to query Kubernetes clusters', region, null, null, clusters.err);
                return rcb();
            }

            if (!clusters.data.length) {
                helpers.addResult(results, 0, 'No Kubernetes clusters found', region);
                return rcb();
            }

            clusters.data.forEach(cluster => {
                let location;
                if (cluster.locations) {
                    location = cluster.locations.length === 1 ? cluster.locations[0] : cluster.locations[0].substring(0, cluster.locations[0].length - 2);
                } else location = region;

                let disabledSecureBootNodes = [];
                let resource = helpers.createResourceName('clusters', cluster.name, project, 'location', location);
                if (cluster.nodePools &&
                    cluster.nodePools.length) {
                    cluster.nodePools.forEach(nodePool => {
                        if (!nodePool.config || !nodePool.config.shieldedInstanceConfig || !nodePool.config.shieldedInstanceConfig.enableSecureBoot) disabledSecureBootNodes.push(nodePool.name);
                    });
                    if (disabledSecureBootNodes.length) {
                        helpers.addResult(results, 2,
                            `Secure Boot is disabled for these node pools: ${disabledSecureBootNodes.join(', ')}`, region, resource);
                    } else {
                        helpers.addResult(results, 0,
                            'Secure Boot is enabled for all node pools', region, resource);
                    } 
                } else {
                    helpers.addResult(results, 0, 'No node pools found', region, resource);
                }
            });

            rcb();
        }, function(){
            callback(null, results, source);
        });
    }
};