// Talks to netlify/functions/guestbook.mjs, which runs OpenAI moderation before saving.
(()=>{
  const $=id=>document.getElementById(id);
  const api='/api/guestbook';
  const status=text=>{$('gb-status').textContent=text};

  async function load(){
    try{
      const res=await fetch(api);
      if(!res.ok)throw 0;
      const rows=await res.json();
      $('gb-list').replaceChildren(...rows.map(r=>{
        const li=document.createElement('li'),b=document.createElement('b'),t=document.createElement('time'),p=document.createElement('p');
        b.textContent=r.name;t.dateTime=r.created_at;t.textContent=new Date(r.created_at).toLocaleDateString();p.textContent=r.body;
        li.append(b,' ',t,p);return li;
      }));
      if(!rows.length)status('No messages yet. Be the first to say hi.');
    }catch{status('Guestbook is offline right now.')}
  }

  $('gb-form').addEventListener('submit',async e=>{
    e.preventDefault();
    const form=e.target,button=form.querySelector('button');
    button.disabled=true;status('Posting…');
    try{
      const res=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:form.name.value,body:form.body.value})});
      if(!res.ok)throw new Error((await res.json().catch(()=>({}))).message||'Could not post. Try again.');
      form.body.value='';status('Thanks for signing!');load();
    }catch(err){status(err.message||'Could not post. Try again.')}
    button.disabled=false;
  });

  load();
})();
