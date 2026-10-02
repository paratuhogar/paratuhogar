(function () {
 'use strict';
 const mount = document.getElementById('studio-app'), params = new URLSearchParams(location.search);
 const client = window.supabase.createClient('https://ljqwaovevfatkiigirhf.supabase.co', 'sb_publishable_DAuFcu0JjUo15yLDAev3MQ_9x5GIVXt');
 window.PTHStudioPage = new window.PTHContentStudio.Studio(mount, client, { query: params.get('q') || '', category: params.get('cat') || 'TODOS' });
})();
