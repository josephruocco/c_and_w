// Talks to netlify/functions/guestbook.mjs, which runs OpenAI moderation before saving.
(()=>{
  const $=id=>document.getElementById(id);
  const api=document.querySelector('meta[name=guestbook-api]')?.content.trim()||'/api/guestbook';
  const status=text=>{$('gb-status').textContent=text};

  let adminToken='';
  const failure=async res=>new Error((await res.json().catch(()=>({}))).message||(res.status===429?'Too many requests. Wait a minute and try again.':'Could not complete the request. Try again.'));
  function lock(){
    adminToken='';$('gb-password').value='';$('gb-admin-form').hidden=false;$('gb-lock').hidden=true;
    document.querySelectorAll('.gb-delete').forEach(button=>button.remove());
  }
  $('gb-lock').addEventListener('click',()=>{lock();status('Admin controls locked.')});
  $('gb-admin').addEventListener('toggle',()=>{if(!$('gb-admin').open)lock()});
  window.addEventListener('pagehide',lock);
  $('gb-admin-form').addEventListener('submit',async e=>{
    e.preventDefault();
    const button=e.target.querySelector('button');button.disabled=true;
    const token=$('gb-password').value;
    try{
      const url=new URL(api,location.href);url.searchParams.set('admin','1');
      const res=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});
      if(!res.ok)throw await failure(res);
      adminToken=token;$('gb-password').value='';$('gb-admin-form').hidden=true;$('gb-lock').hidden=false;
      status('Admin unlocked. Choose a comment to delete.');await load();
    }catch(err){lock();status(err.message)}
    button.disabled=false;
  });

  async function load(){
    try{
      const res=await fetch(api);
      if(!res.ok)throw 0;
      const rows=await res.json();
      $('gb-list').replaceChildren(...rows.map(r=>{
        const li=document.createElement('li'),b=document.createElement('b'),t=document.createElement('time'),p=document.createElement('p');
        b.textContent=r.name;t.dateTime=r.created_at;t.textContent=new Date(r.created_at).toLocaleDateString();p.textContent=r.body;
        li.append(b,' ',t,p);
        if(adminToken&&r.id){
          const remove=document.createElement('button');remove.type='button';remove.className='gb-delete';remove.textContent='Delete comment';
          remove.addEventListener('click',async()=>{
            if(!confirm(`Delete ${r.name}'s comment? This cannot be undone.`))return;
            remove.disabled=true;
            try{
              const url=new URL(api,location.href);url.searchParams.set('id',r.id);
              const res=await fetch(url,{method:'DELETE',headers:{Authorization:`Bearer ${adminToken}`}});
              if(!res.ok){if(res.status===401)lock();throw await failure(res)}
              li.remove();status('Comment deleted.');
            }catch(err){status(err.message);remove.disabled=false}
          });li.append(remove);
        }
        return li;
      }));
      if(!rows.length)status('No messages yet. Be the first to say hi.');
    }catch{status('Guestbook is offline right now.')}
  }

  $('gb-form').addEventListener('submit',async e=>{
    e.preventDefault();
    const form=e.target,button=form.querySelector('button');
    const nameInput=form.elements.namedItem('name'),bodyInput=form.elements.namedItem('body');
    button.disabled=true;status('Posting…');
    try{
      const res=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:nameInput.value,body:bodyInput.value,website:form.elements.namedItem('website').value})});
      if(!res.ok)throw await failure(res);
      bodyInput.value='';status('Thanks for signing!');load();
    }catch(err){status(err.message||'Could not post. Try again.')}
    button.disabled=false;
  });

  load();
})();
