import json, struct, hashlib
from pathlib import Path
root=Path('/Users/wei/Documents/ChatGPT/遊戲練習')
source=root/'assets/model/juggernaut_86_eighty-six.glb'
out=Path(__file__).parent
raw=source.read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);tail=raw[20+n:];binary=tail[8:]
def uv(index):
    a=g['accessors'][index];v=g['bufferViews'][a['bufferView']]
    start=v.get('byteOffset',0)+a.get('byteOffset',0)
    return [struct.unpack_from('<2f',binary,start+i*v.get('byteStride',8)) for i in range(a['count'])]
changed=[]
for mesh in g['meshes']:
    for p in mesh['primitives']:
        material=g['materials'][p['material']]
        normal=material.get('normalTexture',{})
        if normal.get('texCoord',0)==1:
            assert uv(p['attributes']['TEXCOORD_0'])==uv(p['attributes']['TEXCOORD_1']),mesh['name']
            normal['texCoord']=0
            changed.append(material['name'])
g.setdefault('asset',{}).setdefault('extras',{})['s53_change']='Normal UV metadata 1->0 after exact vertex UV equality; original geometry/textures unchanged.'
encoded=json.dumps(g,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
result=struct.pack('<III',0x46546c67,2,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail
(out/'juggernaut-normalized.glb').write_bytes(result)
(out/'normalization.json').write_text(json.dumps({'source_sha256':hashlib.sha256(raw).hexdigest(),'changed_materials':changed,'binary_chunk_unchanged':True,'exact_uv_equality':True},indent=2)+'\n')
print(changed)
