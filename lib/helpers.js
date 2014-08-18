function intersection(A, B) {
  var result = new Array();
  for(i = 0; i < A.length; i++) {
    for(j = 0; j < B.length; j++) {
      if (A[i] == B[j] && result.indexOf(A[i]) == -1) {
        result.push(A[i]);
      }
    }
  }
  return result;
};

module.exports = {
  intersection: intersection
};